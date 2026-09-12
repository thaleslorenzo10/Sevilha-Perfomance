'use strict';

const { lerPayload, validar, conferirOrigem, salvar } = require('../lib/briefing-aula');

// Briefing interno de produção: não representa uma inscrição ou um lead.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }
  try {
    conferirOrigem(req);
    const registro = validar(lerPayload(req));
    return res.status(200).json(await salvar(registro));
  } catch (error) {
    const conhecido = [400, 409, 413, 422, 503].includes(error.status);
    return res.status(conhecido ? error.status : 503).json({
      error: conhecido ? error.message : 'Não foi possível confirmar o salvamento. Tente novamente.',
    });
  }
};
