const express =require('express')
const Groups = require('./groups')

const router = express.Router();


router.use('/groups', Groups)

module.exports = router;