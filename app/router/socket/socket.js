const express = require('express')
const Socket = require("../../service/socketService/router");
const app = express();


app.post('/socket', (req, res) => {
    Socket().postService(req, res)
})

app.get('/checkPort', (req, res) => {
    Socket().checkPortService(req, res)
})

app.get('/serverUpdate', (req, res) => {
    Socket().serverUpdate(req, res)
})

app.post('/deletePort', (req, res) => {
    Socket().deletePort(req, res)
})


module.exports = app