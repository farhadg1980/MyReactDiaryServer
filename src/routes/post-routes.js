import express from "express"

import {
  getPosts,
  saveNewPost,
  updatePost,
  deletePost,
  search
} from "../controller/post-controller"

const router = express.Router()

//returns all posts
router.get("/:limit/:lastPostId", getPosts)

//search
router.get("/search/:filter/:limit/:lastPostId", search)

//save a new post
router.post("/", saveNewPost)

//update post
router.patch("/:postId", updatePost)

//delete post
router.delete("/:postId", deletePost)

export default router
