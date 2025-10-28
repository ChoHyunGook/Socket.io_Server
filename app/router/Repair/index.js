const express =require('express')
const router = express.Router();

const Sunil = require('./Sunil')


router.use('/sunil',Sunil)


module.exports = router;