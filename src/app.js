import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcrypt'
import Joi from 'joi'
import dotenv from 'dotenv'
import { v4 as uuid } from 'uuid'
import dayjs from 'dayjs'
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const mongoClient = new MongoClient(process.env.DATABASE_URL)
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

app.post('/nova-transacao/:tipo', async (req, res) => {
   const { value, description } = req.body
   let { authorization } = req.headers
   authorization = authorization?.replace('Bearer ', '')
   const { tipo: transactionType } = req.params

   if (!authorization) return res.sendStatus(401)

   const transaction = {
      date: dayjs().format('DD/MM'),
      value: Number.parseFloat(value.replace(',', '.')).toFixed(2),
      description,
      transactionType
   }

   const schemaTransaction = Joi.object({
      value: Joi.number().positive(),
      description: Joi.string().required()
   })

   const validate = schemaTransaction.validate(
      { value: transaction.value, description: transaction.description },
      { abortEarly: false }
   )

   if (value == 0) return res.status(422).send('Digite um valor maior que R$ 0.')

   if (validate.error) {
      const errors = validate.error.details.map((detail) => detail.message)
      return res.status(422).send(errors)
   }

   try {
      const user = await db.collection('sessions').findOne({ token: authorization })
      if (!user) return res.sendStatus(422)

      transaction.userID = user.userID
      await db.collection('transactions').insertOne(transaction)

      res.status(200).send(transaction)
   } catch (error) {
      res.status(500).send(error.message)
   }
})

app.get('/home', async (req, res) => {
   let { authorization } = req.headers
   authorization = authorization?.replace('Bearer ', '')

   if (!authorization) return res.sendStatus(401)

   try {
      const user = await db.collection('sessions').findOne({ token: authorization })
      if (!user) return res.sendStatus(422)

      const transactionsUser = await db
         .collection('transactions')
         .find({ userID: user.userID })
         .toArray()

      const { name } = await db.collection('users').findOne({ _id: user.userID })

      res.status(200).send({ name, transactionsUser })
   } catch (error) {
      res.status(500).send(error.message)
   }

   //2 - Filtrar transactions pelo userID
})

app.get('/session', async (req, res) => {
   let { authorization } = req.headers
   authorization = authorization?.replace('Bearer ', '')

   if (!authorization) return res.sendStatus(401)

   try {
      const { userID } = await db.collection('sessions').findOne({ token: authorization })
      if (!userID) return res.sendStatus(422)

      res.sendStatus(200)
   } catch (error) {
      res.sendStatus(500)
   }
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
