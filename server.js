const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectToDatabase } = require('./database');
const responseHandler = require('./middlewares/handlingMiddleware');

dotenv.config();
const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',')
      : [];
    
    allowedOrigins.push('http://localhost:4200'); 

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  credentials: true,
};


app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); 

app.use((req, res, next) => {
  req.setTimeout(300000);
  next();
});

app.use(bodyParser.json({ limit: '1024mb' }));
app.use(bodyParser.urlencoded({ limit: '1024mb', extended: true }));
app.use(responseHandler);

app.use('/', require('./routes/media'));
app.get('/', (req, res) => {
  res.send('<h1>Hello World</h1>');
});

app.use('/api/v1', require('./routes/router'));

app.use((err, req, res, next) => {
  if (err instanceof Error && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'CORS policy violation.' });
  }
  next(err);
});

const startServer = async () => {
  try {
    await connectToDatabase();
    const port = process.env.PORT || 8080;
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (err) {
    console.error(`Failed to connect to database: ${err.message}`);
    process.exit(1);
  }
};

startServer();
