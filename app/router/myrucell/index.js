const express = require('express')
const app = express();
const applyDotenv = require("../../../lambdas/applyDotenv");
const dotenv = require("dotenv");
const EagleSafesInquiries = require("../../service/myrucell");

//플랫폼 문의 + A/S + user
app.get('/get',async (req, res) => {
    const myRucellService = await EagleSafesInquiries(); // 비동기 호출
    myRucellService.getMyrucell(req, res)
})

//inquiries

app.post('/create/inquiries',async (req, res) => {
    const inquiriesService = await EagleSafesInquiries(); // 비동기 호출
    inquiriesService.createInquiries(req, res)
})
app.post('/update/inquiries',async (req, res) => {
    const inquiriesService = await EagleSafesInquiries(); // 비동기 호출
    inquiriesService.updateInquiries(req, res)
})
app.post('/delete/inquiries',async (req, res) => {
    const inquiriesService = await EagleSafesInquiries(); // 비동기 호출
    inquiriesService.deleteInquiries(req, res)
})


module.exports = app