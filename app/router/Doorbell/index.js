const express = require('express')
const app = express();
const Doorbell = require('../../service/Doorbell')


app.post('/signUp',(req,res)=>{
    Doorbell().signUp(req,res)
})


app.post('/send/signUp/email',(req,res)=>{
    Doorbell().signUpEmail(req,res)
})

app.post('/send/find/email',(req,res)=>{
    Doorbell().findEmail(req,res)
})

app.patch('/patch/user',(req,res)=>{
    Doorbell().updateUser(req,res);
})

app.post('/auto/signIn',(req,res)=>{
    Doorbell().autoSignIn(req,res)
})


module.exports = app