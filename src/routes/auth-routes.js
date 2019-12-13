import express from "express"

import { checkKey } from "../controller/auth-controller"

const router = express.Router()

//save new post
router.post("/", checkKey)

export default router
