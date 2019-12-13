import mongoose, { Schema } from "mongoose"

const PostSchema = new Schema({
  title: String,
  desc: String,
  date: String,
  hashedKey: String,
  salt: String //is used to hash this key, this is different for each post
})

const Post = mongoose.model("post", PostSchema)

export default Post
