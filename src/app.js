import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcrypt'
import Joi from 'joi'
import dotenv from 'dotenv'
import { v4 as uuid } from 'uuid'
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const mongoClient = new MongoClient(process.env.DATABASE_URL, { family: 4 })
let db

mongoClient
   .connect()
   .then(() => {
      console.log('MONGODB CONECTADO!')
      db = mongoClient.db()
   })
   .catch((err) => console.log(`ERROR: ${err.message}`))

app.post('/cadastro', async (req, res) => {
   const { name, email, password } = req.body

   const schemaSignUpUser = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email({ maxDomainSegments: 2 }).required(),
      password: Joi.string().min(3).required()
   })

   const validate = schemaSignUpUser.validate(req.body, { abortEarly: false })

   if (validate.error) {
      const errors = validate.error.details.map((detail) => detail.message)
      return res.status(422).send(errors)
   }

   try {
      const user = await db.collection('users').findOne({ email })

      if (user) return res.status(409).send('Este e-mail já está sendo utilizado em outra conta.')

      await db
         .collection('users')
         .insertOne({ name, email, password: bcrypt.hashSync(password, 10) })

      res.sendStatus(201)
   } catch (error) {
      res.status(500).send(error.message)
   }
})

app.post('/', async (req, res) => {
   const { email, password } = req.body

   const schemaSignInUser = Joi.object({
      email: Joi.string().email({ maxDomainSegments: 2 }).required(),
      password: Joi.string().required()
   })

   const validate = schemaSignInUser.validate(req.body, { abortEarly: false })

   if (validate.error) {
      const errors = validate.error.details.map((detail) => detail.message)
      return res.status(422).send(errors)
   }

   try {
      const user = await db.collection('users').findOne({ email })

      if (!user) return res.status(404).send('Usuário não cadastrado!')
      if (!bcrypt.compareSync(password, user.password))
         return res.status(401).send('Senha incorreta!')

      const token = uuid()
      await db.collection('sessions').insertOne({ token, userID: user._id })
      res.status(200).send(token)
   } catch (error) {
      res.status(500).send(error.message)
   }
})

const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
