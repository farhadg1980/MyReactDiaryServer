import { Types } from "mongoose"
import randomize from "randomatic"
import { Promise } from "bluebird"

import { validateKey, createNewGeneralKey } from "../controller/auth-controller"
import Post from "../models/post-model"
import { handleError, hashKey } from "../tools"

Promise.config({
  cancellation: true
})

export const getPosts = (req, res) => {
  const { limit, lastPostId } = req.params

  //id validation, if there is no lastPostId then first page is returned
  if (lastPostId != " " && !Types.ObjectId.isValid(lastPostId)) {
    //invalid post id
    return res.status(400).send()
  }

  //limit validation
  if (isNaN(limit)) {
    return res.status(400).send()
  }

  let withLastPostIdCondition = {}
  if (lastPostId != " ") {
    withLastPostIdCondition = { _id: { $lt: lastPostId } }
  }

  const withoutLastPostIdCondition = {}

  findPosts(withLastPostIdCondition, withoutLastPostIdCondition, limit)
    .then(result => res.send(result))
    .catch(err => {
      handleError(err)
      res.status(500).send()
    })
}

export const search = (req, res) => {
  const { filter, limit, lastPostId } = req.params

  //id validation, if there is no lastPostId then first page is returned
  if (lastPostId != " " && !Types.ObjectId.isValid(lastPostId)) {
    //invalid post id
    return res.status(400).send()
  }

  //limit validation
  if (isNaN(limit)) {
    return res.status(400).send()
  }

  //create regex for search
  let regex = ""
  const filters = filter.split(" ")
  filters.forEach(con => {
    regex += `(.*${con}.*)|`
  })
  regex = regex.substring(0, regex.length - 1) //remove last |

  const regexCondition = { $regex: regex }

  const withoutLastPostIdCondition = {
    $or: [
      { title: regexCondition },
      { desc: regexCondition },
      { date: regexCondition }
    ]
  }

  //because we get last post id from url params, if we need first page we send " " for this parameter
  let withLastPostIdCondition
  if (lastPostId != " ") {
    withLastPostIdCondition = {
      $and: [{ _id: { $lt: lastPostId } }, withoutLastPostIdCondition]
    }
  } else {
    withLastPostIdCondition = withoutLastPostIdCondition
  }

  findPosts(withLastPostIdCondition, withoutLastPostIdCondition, limit)
    .then(result => res.send(result))
    .catch(err => {
      handleError(err)
      res.status(500).send()
    })
}

//find post
const findPosts = (
  withLastPostIdCondition, //to fetch new page from a specific postId
  withoutLastPostIdCondition, //to see if there is more posts after this returned page
  limit //page size
) => {
  return new Promise((resolve, reject) => {
    let currentResult
    let hasMore = true
    Post.find(withLastPostIdCondition, { hashedKey: 0, salt: 0, __v: 0 })
      .sort({ _id: -1 }) //new post at the top
      .limit(parseInt(limit))
      .then(result => {
        if (result.length === 0) {
          //there is no post
          return Promise.resolve(null)
        } else {
          currentResult = result
          //check if there is more, find oldes post
          return Post.find(withoutLastPostIdCondition).limit(1)
        }
      })
      .then(result => {
        if (result === null) {
          //there is no post
          resolve({
            posts: [],
            hasMore: false
          })
        } else {
          const dbLastItem = result[0]
          const currentLastItem = currentResult[currentResult.length - 1]
          if (currentLastItem._id.equals(dbLastItem._id)) {
            //there is no more items
            hasMore = false
          }
          resolve({
            posts: currentResult,
            hasMore
          })
        }
      })
      .catch(err => reject(err))
  })
}

//save newp ost and return a new general key
export const saveNewPost = (req, res) => {
  const { title, desc, date } = req.body.post
  const { key } = req.body

  //check if parameters are valid
  if (
    key === undefined ||
    title === undefined ||
    title === "" ||
    desc === undefined ||
    desc === "" ||
    date === undefined ||
    date === ""
  ) {
    //invalid data
    return res.status(400).send()
  }

  let newGeneralKey, postKey

  //validate key, there is no post id for new post
  const promise = validateKey(key, "")
    .then(result => {
      if (result.isValid) {
        //valid general key, create a new one
        return createNewGeneralKey()
      } else {
        //invalid key
        promise.cancel()
        return res.status(400).send()
      }
    })
    .then(result => {
      newGeneralKey = result

      //create a post key
      return createNewPostKey()
    })
    .then(result => {
      postKey = result.randomKey
      //create and save post
      const newPost = new Post({
        title,
        desc,
        date,
        hashedKey: result.hashedKey,
        salt: result.salt
      })

      return newPost.save()
    })
    .then(post => {
      //send back post and generated keys
      res.send({
        post: {
          _id: post._id,
          title: post.title,
          desc: post.desc,
          date: post.date
        },
        newGeneralKey,
        postKey
      })
    })
    .catch(err => {
      handleError(err)
      res.status(500).send()
    })
}

//create a new random key for postKey
const createNewPostKey = () =>
  new Promise((resolve, reject) => {
    const randomKey = randomize("0", 8)
    const salt = randomize("*", 8)
    hashKey(randomKey, salt)
      .then(hashedKey => {
        resolve({
          randomKey,
          hashedKey,
          salt
        })
      })
      .catch(err => reject(err))
  })

//update an existing post
export const updatePost = (req, res) => {
  const { postId } = req.params
  const { title, desc, date } = req.body.post
  const { key } = req.body

  if (key === undefined || key === "") {
    //invalid key
    return res.status(400).send()
  }

  //id validation
  if (!Types.ObjectId.isValid(postId)) {
    //invalid post id
    return res.status(400).send()
  }

  //post item validation
  if (
    title === undefined ||
    title === "" ||
    desc === undefined ||
    desc === "" ||
    date === undefined ||
    date === ""
  ) {
    //invalid data
    return res.status(400).send()
  }

  let isGeneralKey, newGeneralKey
  //validate key, key and postId are available here
  const promise = validateKey(key, postId)
    .then(result => {
      if (result.isValid) {
        if (result.isGeneral) {
          //a general key is used, create new one
          isGeneralKey = true
          return createNewGeneralKey()
        } else {
          //post key is used
          isGeneralKey = false
          return Promise.resolve()
        }
      } else {
        //invalid key
        promise.cancel()
        return res.status(400).send()
      }
    })
    .then(result => {
      if (isGeneralKey) {
        //a new general key is generated on the previous step
        newGeneralKey = result
      }
      return Post.findOneAndUpdate({ _id: postId }, { title, desc, date })
    })
    .then(() => {
      //document updated, send new general key if it was used to update this post
      res.status(200).send({
        newGeneralKey: isGeneralKey ? newGeneralKey : ""
      })
    })
    .catch(err => {
      handleError(err)
      res.status(500).send()
    })
}

//delete existing post
export const deletePost = (req, res) => {
  const { postId } = req.params
  const { key } = req.body

  //id validation
  if (!Types.ObjectId.isValid(postId)) {
    //invalid post id
    return res.status(400).send()
  }

  if (key === undefined || key === "") {
    //invalid key
    return res.status(400).send()
  }

  let isGeneralKey, newGeneralKey
  //validate key, key and postId are available here
  const promise = validateKey(key, postId)
    .then(result => {
      if (result.isValid) {
        if (result.isGeneral) {
          //a general key is used, create new one
          isGeneralKey = true
          return createNewGeneralKey()
        } else {
          //post key is used
          isGeneralKey = false
          return Promise.resolve()
        }
      } else {
        //invalid key
        promise.cancel()
        return res.status(400).send()
      }
    })
    .then(result => {
      if (isGeneralKey) {
        //a new general key is generated on the previous step
        newGeneralKey = result
      }
      return Post.findByIdAndRemove(postId)
    })
    .then(() => {
      //document deleted, send new general key if it was used to delete this post
      res.status(200).send({
        newGeneralKey: isGeneralKey ? newGeneralKey : ""
      })
    })
    .catch(err => {
      handleError(err)
      res.status(500).send()
    })
}
