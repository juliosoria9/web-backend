// src/controllers/client.controller.js
import Client from '../models/Client.js'
import AppError from '../utils/AppError.js'

// Crea un nuevo cliente para la compañía del usuario que hace la petición
export const createClient = async (req, res, next) => {
  try {
    // Sacamos los datos del cuerpo de la petición
    const { name, cif, email, phone, address } = req.body

    // Comprobamos si ya hay un cliente con ese CIF en la misma compañía
    // (no queremos duplicados dentro de la misma empresa)
    const clienteExistente = await Client.findOne({
      cif: cif,
      company: req.user.company
    })

    if (clienteExistente) {
      return next(AppError.conflict('Ya existe un cliente con ese CIF en tu compañía'))
    }

    // Si no existe, creamos el cliente y lo asociamos al usuario y a su compañía
    const nuevoCliente = await Client.create({
      user: req.user._id,
      company: req.user.company,
      name: name,
      cif: cif,
      email: email,
      phone: phone,
      address: address
    })

    // Avisamos por Socket.IO a todos los miembros de la compañía
    // para que vean el cliente nuevo en tiempo real
    const io = req.app.locals.io
    if (io) {
      io.to(`company:${req.user.company}`).emit('client:new', nuevoCliente)
    }

    // Devolvemos el cliente creado con código 201 (Created)
    res.status(201).json({ client: nuevoCliente })
  } catch (error) {
    next(error)
  }
}

// Devuelve la lista de clientes activos de la compañía con paginación y filtros
export const getClients = async (req, res, next) => {
  try {
    // --- PAGINACIÓN ---
    // Página actual que pide el usuario (mínimo 1, por defecto 1)
    const page = Math.max(1, parseInt(req.query.page) || 1)

    // Número de clientes por página (mínimo 1, por defecto 10)
    const limit = Math.max(1, parseInt(req.query.limit) || 10)

    // Cuántos documentos saltar para llegar a la página pedida
    // Ejemplo: página 3 con limit 10 -> saltar 20 documentos
    const skip = (page - 1) * limit

    // --- FILTROS ---
    // Filtro base: solo clientes de la compañía del usuario y NO archivados
    const filter = {
      company: req.user.company,
      deleted: false
    }

    // Filtro opcional por nombre (búsqueda parcial e ignora mayúsculas/minúsculas)
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: 'i' }
    }

    // Orden de los resultados (por defecto, los más recientes primero)
    const sort = req.query.sort || '-createdAt'

    // --- CONSULTA ---
    // Lanzamos en paralelo la búsqueda de clientes y el conteo total
    // (es más rápido que hacerlo una detrás de otra)
    const [clients, totalItems] = await Promise.all([
      Client.find(filter).sort(sort).skip(skip).limit(limit),
      Client.countDocuments(filter)
    ])

    // Calculamos cuántas páginas hay en total
    const totalPages = Math.ceil(totalItems / limit)

    // Devolvemos la lista junto con la información de paginación
    res.json({
      clients: clients,
      totalItems: totalItems,
      totalPages: totalPages,
      currentPage: page
    })
  } catch (error) {
    next(error)
  }
}

// Devuelve un cliente concreto por su id (siempre que sea de la compañía del usuario)
export const getClientById = async (req, res, next) => {
  try {
    // Buscamos por id, comprobando que es de la compañía y no está archivado
    const client = await Client.findOne({
      _id: req.params.id,
      company: req.user.company,
      deleted: false
    })

    // Si no existe (o no pertenece a la compañía), devolvemos error 404
    if (!client) {
      return next(AppError.notFound('Cliente no encontrado'))
    }

    res.json({ client: client })
  } catch (error) {
    next(error)
  }
}

// Actualiza los datos de un cliente de la compañía
export const updateClient = async (req, res, next) => {
  try {
    // Buscamos y actualizamos en una sola operación
    // Solo actualiza si el cliente pertenece a la compañía y no está archivado
    const client = await Client.findOneAndUpdate(
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

    if (!client) {
      return next(AppError.notFound('Cliente no encontrado'))
    }

    res.json({ client: client })
  } catch (error) {
    next(error)
  }
}

// Elimina un cliente. Si llega ?soft=true es archivado (borrado lógico), si no, borrado real
export const deleteClient = async (req, res, next) => {
  try {
    // Comprobamos si el usuario quiere borrado lógico (archivar)
    const isSoftDelete = req.query.soft === 'true'

    if (isSoftDelete) {
      // Borrado lógico: marcamos el cliente como deleted=true
      // De esta forma se puede recuperar más tarde
      const cliente = await Client.findOneAndUpdate(
        {
          _id: req.params.id,
          company: req.user.company,
          deleted: false
        },
        { deleted: true },
        { new: true }
      )

      if (!cliente) {
        return next(AppError.notFound('Cliente no encontrado'))
      }

      return res.json({ message: 'Cliente archivado correctamente' })
    }

    // Borrado físico: eliminamos el documento de la base de datos para siempre
    const cliente = await Client.findOneAndDelete({
      _id: req.params.id,
      company: req.user.company
    })

    if (!cliente) {
      return next(AppError.notFound('Cliente no encontrado'))
    }

    res.json({ message: 'Cliente eliminado correctamente' })
  } catch (error) {
    next(error)
  }
}

// Devuelve la lista de clientes archivados (deleted=true) de la compañía
export const getArchivedClients = async (req, res, next) => {
  try {
    // --- PAGINACIÓN ---
    // Página actual (mínimo 1, por defecto 1)
    const page = Math.max(1, parseInt(req.query.page) || 1)

    // Resultados por página (mínimo 1, por defecto 10)
    const limit = Math.max(1, parseInt(req.query.limit) || 10)

    // Documentos a saltar para llegar a la página pedida
    const skip = (page - 1) * limit

    // --- FILTROS ---
    // Filtro base: clientes de la compañía del usuario que SÍ están archivados
    const filter = {
      company: req.user.company,
      deleted: true
    }

    // Filtro opcional por nombre (búsqueda parcial e ignora mayúsculas/minúsculas)
    if (req.query.name) {
      filter.name = { $regex: req.query.name, $options: 'i' }
    }

    // Orden (por defecto, los más recientes primero)
    const sort = req.query.sort || '-createdAt'

    // --- CONSULTA ---
    // Lanzamos en paralelo la búsqueda y el conteo total
    const [clients, totalItems] = await Promise.all([
      Client.find(filter).sort(sort).skip(skip).limit(limit),
      Client.countDocuments(filter)
    ])

    // Calculamos el número total de páginas
    const totalPages = Math.ceil(totalItems / limit)

    res.json({
      clients: clients,
      totalItems: totalItems,
      totalPages: totalPages,
      currentPage: page
    })
  } catch (error) {
    next(error)
  }
}

// Restaura un cliente archivado (vuelve a poner deleted=false)
export const restoreClient = async (req, res, next) => {
  try {
    // Solo se puede restaurar si está archivado (deleted=true) y es de la compañía
    const client = await Client.findOneAndUpdate(
      {
        _id: req.params.id,
        company: req.user.company,
        deleted: true
      },
      { deleted: false },
      { new: true }
    )

    if (!client) {
      return next(AppError.notFound('Cliente archivado no encontrado'))
    }

    res.json({
      message: 'Cliente restaurado correctamente',
      client: client
    })
  } catch (error) {
    next(error)
  }
}
