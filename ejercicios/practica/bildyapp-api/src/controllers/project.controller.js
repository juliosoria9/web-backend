// src/controllers/project.controller.js
import Project from '../models/Project.js'
import Client from '../models/Client.js'
import AppError from '../utils/AppError.js'

// Crea un nuevo proyecto para la compañía del usuario que hace la petición
export const createProject = async (req, res, next) => {
  try {
    // Sacamos los datos del cuerpo de la petición
    const { name, projectCode, client, email, notes, address, active } = req.body

    // Comprobamos si ya existe un proyecto con el mismo código en la compañía
    // (no queremos códigos de proyecto duplicados dentro de la misma empresa)
    const proyectoExistente = await Project.findOne({
      projectCode: projectCode,
      company: req.user.company
    })

    if (proyectoExistente) {
      return next(AppError.conflict('Ya existe un proyecto con ese código en tu compañía'))
    }

    // Comprobamos que el cliente al que asociamos el proyecto existe,
    // pertenece a la misma compañía y no está archivado
    const clienteAsociado = await Client.findOne({
      _id: client,
      company: req.user.company,
      deleted: false
    })

    if (!clienteAsociado) {
      return next(AppError.notFound('Cliente no encontrado o no pertenece a tu compañía'))
    }

    // Creamos el proyecto y lo asociamos al usuario, a su compañía y al cliente
    const nuevoProyecto = await Project.create({
      user: req.user._id,
      company: req.user.company,
      client: client,
      name: name,
      projectCode: projectCode,
      email: email,
      notes: notes,
      address: address,
      active: active
    })

    // Avisamos por Socket.IO a todos los miembros de la compañía
    // para que vean el proyecto nuevo en tiempo real
    const io = req.app.locals.io
    if (io) {
      io.to(`company:${req.user.company}`).emit('project:new', nuevoProyecto)
    }

    // Devolvemos el proyecto creado con código 201 (Created)
    res.status(201).json({ project: nuevoProyecto })
  } catch (error) {
    next(error)
  }
}

// Devuelve la lista de proyectos activos de la compañía con paginación y filtros
export const getProjects = async (req, res, next) => {
  try {
    // --- PAGINACIÓN ---
    // Página actual que pide el usuario (mínimo 1, por defecto 1)
    const page = Math.max(1, parseInt(req.query.page) || 1)

    // Número de proyectos por página (mínimo 1, por defecto 10)
    const limit = Math.max(1, parseInt(req.query.limit) || 10)

    // Cuántos documentos saltar para llegar a la página pedida
    // Ejemplo: página 3 con limit 10 -> saltar 20 documentos
    const skip = (page - 1) * limit

    // --- FILTROS ---
    // Filtro base: solo proyectos de la compañía del usuario y NO archivados
    const filter = {
      company: req.user.company,
      deleted: false
    }

    // Filtro opcional por nombre (búsqueda parcial e ignora mayúsculas/minúsculas)
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: 'i' }
    }

    // Filtro opcional por cliente (proyectos de un cliente concreto)
    if (req.query.client) {
      filter.client = req.query.client
    }

    // Filtro opcional por estado activo/inactivo
    // Llega como string "true" o "false", lo convertimos a booleano
    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true'
    }

    // Orden de los resultados (por defecto, los más recientes primero)
    const sort = req.query.sort || '-createdAt'

    // --- CONSULTA ---
    // Lanzamos en paralelo la búsqueda de proyectos y el conteo total
    // populate trae también los datos básicos del cliente (name y cif)
    const [projects, totalItems] = await Promise.all([
      Project.find(filter)
        .populate('client', 'name cif')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Project.countDocuments(filter)
    ])

    // Calculamos cuántas páginas hay en total
    const totalPages = Math.ceil(totalItems / limit)

    // Devolvemos la lista junto con la información de paginación
    res.json({
      projects: projects,
      totalItems: totalItems,
      totalPages: totalPages,
      currentPage: page
    })
  } catch (error) {
    next(error)
  }
}

// Devuelve un proyecto concreto por su id (siempre que sea de la compañía del usuario)
export const getProjectById = async (req, res, next) => {
  try {
    // Buscamos por id, comprobando que es de la compañía y no está archivado
    // populate trae los datos básicos del cliente y del usuario que lo creó
    const project = await Project.findOne({
      _id: req.params.id,
      company: req.user.company,
      deleted: false
    })
      .populate('client', 'name cif')
      .populate('user', 'name email')

    if (!project) {
      return next(AppError.notFound('Proyecto no encontrado'))
    }

    res.json({ project: project })
  } catch (error) {
    next(error)
  }
}

// Actualiza los datos de un proyecto de la compañía
export const updateProject = async (req, res, next) => {
  try {
    // Si en la actualización se cambia el cliente, hay que comprobar
    // que el nuevo cliente pertenece a la compañía y está activo
    if (req.body.client) {
      const clienteAsociado = await Client.findOne({
        _id: req.body.client,
        company: req.user.company,
        deleted: false
      })

      if (!clienteAsociado) {
        return next(AppError.notFound('Cliente no encontrado o no pertenece a tu compañía'))
      }
    }

    // Buscamos y actualizamos el proyecto en una sola operación
    // Solo actualiza si pertenece a la compañía y no está archivado
    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.id,
        company: req.user.company,
        deleted: false
      },
      req.body,
      {
        new: true,           // devuelve el documento actualizado
        runValidators: true  // aplica las validaciones del esquema
      }
    )

    if (!project) {
      return next(AppError.notFound('Proyecto no encontrado'))
    }

    res.json({ project: project })
  } catch (error) {
    next(error)
  }
}

// Elimina un proyecto. Si llega ?soft=true es archivado (borrado lógico), si no, borrado real
export const deleteProject = async (req, res, next) => {
  try {
    // Comprobamos si el usuario quiere borrado lógico (archivar)
    const isSoftDelete = req.query.soft === 'true'

    if (isSoftDelete) {
      // Borrado lógico: marcamos el proyecto como deleted=true
      // De esta forma se puede recuperar más tarde
      const proyecto = await Project.findOneAndUpdate(
        {
          _id: req.params.id,
          company: req.user.company,
          deleted: false
        },
        { deleted: true },
        { new: true }
      )

      if (!proyecto) {
        return next(AppError.notFound('Proyecto no encontrado'))
      }

      return res.json({ message: 'Proyecto archivado correctamente' })
    }

    // Borrado físico: eliminamos el documento de la base de datos para siempre
    const proyecto = await Project.findOneAndDelete({
      _id: req.params.id,
      company: req.user.company
    })

    if (!proyecto) {
      return next(AppError.notFound('Proyecto no encontrado'))
    }

    res.json({ message: 'Proyecto eliminado correctamente' })
  } catch (error) {
    next(error)
  }
}

// Devuelve la lista de proyectos archivados (deleted=true) de la compañía
export const getArchivedProjects = async (req, res, next) => {
  try {
    // --- PAGINACIÓN ---
    // Página actual (mínimo 1, por defecto 1)
    const page = Math.max(1, parseInt(req.query.page) || 1)

    // Resultados por página (mínimo 1, por defecto 10)
    const limit = Math.max(1, parseInt(req.query.limit) || 10)

    // Documentos a saltar para llegar a la página pedida
    const skip = (page - 1) * limit

    // --- FILTROS ---
    // Filtro base: proyectos de la compañía del usuario que SÍ están archivados
    const filter = {
      company: req.user.company,
      deleted: true
    }

    // Filtro opcional por nombre (búsqueda parcial e ignora mayúsculas/minúsculas)
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: 'i' }
    }

    // Filtro opcional por cliente
    if (req.query.client) {
      filter.client = req.query.client
    }

    // Orden (por defecto, los más recientes primero)
    const sort = req.query.sort || '-createdAt'

    // --- CONSULTA ---
    // Lanzamos en paralelo la búsqueda y el conteo total
    const [projects, totalItems] = await Promise.all([
      Project.find(filter)
        .populate('client', 'name cif')
        .sort(sort)
        .skip(skip)
        .limit(limit),
      Project.countDocuments(filter)
    ])

    // Calculamos el número total de páginas
    const totalPages = Math.ceil(totalItems / limit)

    res.json({
      projects: projects,
      totalItems: totalItems,
      totalPages: totalPages,
      currentPage: page
    })
  } catch (error) {
    next(error)
  }
}

// Restaura un proyecto archivado (vuelve a poner deleted=false)
export const restoreProject = async (req, res, next) => {
  try {
    // Solo se puede restaurar si está archivado (deleted=true) y es de la compañía
    const project = await Project.findOneAndUpdate(
      {
        _id: req.params.id,
        company: req.user.company,
        deleted: true
      },
      { deleted: false },
      { new: true }
    )

    if (!project) {
      return next(AppError.notFound('Proyecto archivado no encontrado'))
    }

    res.json({
      message: 'Proyecto restaurado correctamente',
      project: project
    })
  } catch (error) {
    next(error)
  }
}
