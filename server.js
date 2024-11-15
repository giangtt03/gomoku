const express = require('express');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const favicon = require('express-favicon');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

dotenv.config();
app.use(morgan('dev'));
app.use(cookieParser());
mongoose.connect(process.env.MONGO_URL).then(()=>{
    console.log('Db connected')
}).catch((err)=> console.log(err));

app.use(favicon(__dirname + '/public/fac.ico')); // Ctrl + F5 clear cache

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));
app.use(express.json());


app.use(methodOverride('_method'));

//ghi log các yêu cầu HTTP
app.use(morgan('dev'));

// ghi log cookie
app.use(cookieParser());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;


const gameRoutes = require('./routes/gmkRoute');
const guestRoutes = require('./routes/guestRoutes');


app.use('/', gameRoutes(io)); 
app.use('/go', guestRoutes(io));


server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
