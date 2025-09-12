const express = require('express')
const PORT = 3001 || process.env.PORT
require("dotenv").config();
const app = express()
const cookieParser = require("cookie-parser");
const cors = require('cors')
app.use(express.json())
app.use(cookieParser()); 
const adminRouter = require('./routes/authRoutes')
const ingestRouter = require('./routes/injestionRoutes')
const metricsRouter = require('./routes/metricsRoutes')
const webhookRouter = require('./routes/webHookRoutes')

const corsOptions = {
  origin: "https://tenant-analytics.vercel.app/",
  credentials: true
};
app.use(cors(corsOptions));

app.use('/admin' , adminRouter)
app.use('/ingest' , ingestRouter)
app.use('/metrics' , metricsRouter)
app.use("/webhooks", webhookRouter);


app.get('/', (req, res) => {
  return res.json({ msg: 'Xeno backend running' });
});

app.listen(PORT , ()=>{
    console.log('Server is running!');
})