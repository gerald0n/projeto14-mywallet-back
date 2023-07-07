import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import bcrypt from 'bcrypt'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const mongoClient = new MongoClient(process.env.DATABASE_URL, { family: 4 })
let db

mongoClient
   .connect()
   .then(() => console.log('MONGODB CONECTADO!'))
   .catch((err) => console.log(`ERROR: ${err.message}`))

app.post('/sign-up', async (req, res) => {
   const { nome, email, senha } = req.body

   const hash = bcrypt.hashSync(senha, 10)

   try {
      await db.collection('usuarios').insertOne({ nome, email, senha: hash })
      res.sendStatus(201)
   } catch (error) {
      res.status(500).send(error.message)
   }
})

app.post('/sign-in', async (req, res) => {
   const { email, senha } = req.body

   try {
      const usuario = await db.collection('usuarios').findOne({ email })
      const isCorrectPassword = bcrypt.compareSync(senha, usuario.senha)

      if(!usuario) return res.status(404).send("Usuário não cadastrado!")
      if(!isCorrectPassword) return res.status(401).send("Senha incorreta!")

      res.sendStatus(200)

   } catch (error) {
      res.status(500).send(error.message)
   }
})

const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
