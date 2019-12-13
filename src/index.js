import express from "express"
import mongoose from "mongoose"
import bodyParser from "body-parser"
import morganBody from "morgan-body"
import { Promise } from "bluebird"
import cors from "cors"

import postRoutes from "./routes/post-routes"
import authRoutes from "./routes/auth-routes"

Promise.config({
  cancellation: true
})

const dbAddress=""
const username=""
const password=""

const app = express()
const PORT = 3000

//add cors header to each response
app.use(cors()) //middleware

// logging, debug purpose only
morganBody(app) //http logger middleware, create a log when each request received
mongoose.set("debug", true) //create a log when each query executed on mongodb

// mongoose config and connection
mongoose.Promise = Promise
mongoose.connect(dbAddress, {
  user: username,
  pass: password,
  dbName: "myreactdiary",
  useNewUrlParser: true,
  useUnifiedTopology: true
})

// middleware - body parser
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// routes
app.use("/api/posts", postRoutes)
app.use("/api/auth", authRoutes)

// invalid routes
app.all("*", function(req, res) {
  res.status(404).send()
})

// start server
app.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log(`listening on port ${PORT}`)
})
