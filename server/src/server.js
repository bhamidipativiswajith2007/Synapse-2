import express from "express"
// import dotenv from 'dotenv'
// dotenv.config();//to accese the env file

import {ENV} from './lib/env.js'

let app=express();

app.get('/health',(re,res)=>{
res.status(200).json({msg:"apii is healthy "})
})

app.listen(3000,()=>console.log(`server ruuning on port 3000 ${ENV.PORT}`))