// src/services/pdf.service.js
// Genera el PDF de un albarán con pdfkit
// El objeto deliveryNote tiene que tener client, project y user ya cargados (populated)
import PDFDocument from 'pdfkit'

// Crea el PDF y devuelve un Buffer con los bytes del documento
export const generateDeliveryNotePdf = (deliveryNote) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Título y nombre de la empresa
    doc.fontSize(22).font('Helvetica-Bold').text('ALBARÁN', { align: 'center' })
    doc.moveDown(0.5)

    const companyName = deliveryNote.company && deliveryNote.company.name ? deliveryNote.company.name : 'BildyApp'
    doc.fontSize(14).font('Helvetica').text(companyName, { align: 'center' })
    doc.moveDown(1)

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
    doc.moveDown(0.8)

    // Datos del cliente
    doc.fontSize(12).font('Helvetica-Bold').text('CLIENTE')
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')

    const client = deliveryNote.client
    if (client) {
      doc.text(`Nombre: ${client.name || '—'}`)
      doc.text(`CIF: ${client.cif || '—'}`)
      doc.text(`Email: ${client.email || '—'}`)
    } else {
      doc.text('Datos del cliente no disponibles')
    }
    doc.moveDown(0.8)

    // Datos del proyecto
    doc.fontSize(12).font('Helvetica-Bold').text('PROYECTO')
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')

    const project = deliveryNote.project
    if (project) {
      doc.text(`Nombre: ${project.name || '—'}`)
      doc.text(`Código: ${project.code || '—'}`)
    } else {
      doc.text('Datos del proyecto no disponibles')
    }
    doc.moveDown(0.8)

    // Detalle del trabajo
    doc.fontSize(12).font('Helvetica-Bold').text('DETALLE DEL ALBARÁN')
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')

    const formatLabel = deliveryNote.format === 'hours' ? 'Por horas' : 'Por material'
    doc.text(`Formato: ${formatLabel}`)
    doc.text(`Descripción: ${deliveryNote.description || '—'}`)

    let workDateText = '—'
    if (deliveryNote.workDate) {
      workDateText = new Date(deliveryNote.workDate).toLocaleDateString('es-ES')
    }
    doc.text(`Fecha de trabajo: ${workDateText}`)
    doc.moveDown(0.5)

    if (deliveryNote.format === 'material') {
      doc.text(`Material: ${deliveryNote.material || '—'}`)
      doc.text(`Cantidad: ${deliveryNote.quantity || '—'} ${deliveryNote.unit || ''}`)
    } else {
      doc.text(`Total de horas: ${deliveryNote.hours || '—'}`)
    }
    doc.moveDown(0.8)

    // Trabajadores (solo si el albarán es de horas y hay alguno)
    const tieneWorkers = deliveryNote.workers && deliveryNote.workers.length > 0
    if (deliveryNote.format === 'hours' && tieneWorkers) {
      doc.fontSize(12).font('Helvetica-Bold').text('TRABAJADORES')
      doc.moveDown(0.3)
      doc.fontSize(10).font('Helvetica')

      deliveryNote.workers.forEach((worker, index) => {
        doc.text(`${index + 1}. ${worker.name || 'Sin nombre'} — ${worker.hours || 0} h`)
      })
      doc.moveDown(0.8)
    }

    // Firma
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
    doc.moveDown(0.8)
    doc.fontSize(12).font('Helvetica-Bold').text('FIRMA')
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')

    if (deliveryNote.signed) {
      let signedAtText = '—'
      if (deliveryNote.signedAt) {
        signedAtText = new Date(deliveryNote.signedAt).toLocaleDateString('es-ES')
      }
      doc.text(`Estado: Firmado el ${signedAtText}`)
      doc.moveDown(0.5)

      if (deliveryNote.signatureUrl) {
        doc.text('Imagen de la firma:')
        doc.moveDown(0.3)
        try {
          doc.image(deliveryNote.signatureUrl, { width: 200 })
        } catch {
          doc.text('[No se pudo cargar la imagen de la firma]')
        }
      }
    } else {
      doc.text('Estado: Pendiente de firma')
    }

    doc.moveDown(1)

    // Pie de página
    const fecha = new Date().toLocaleDateString('es-ES')
    doc.fontSize(8).fillColor('gray').text(`Documento generado el ${fecha}`, { align: 'right' })

    doc.end()
  })
}
