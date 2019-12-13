import mongoose, { Schema } from "mongoose"

const KeySchema = new Schema({
  hashedKey: String,
  salt: String //is used to hash this key
})

const Key = mongoose.model("key", KeySchema)

export default Key
