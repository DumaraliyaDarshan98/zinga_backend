import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
// import cluster from 'cluster';
// import os from 'os';
import defaultRoutes from './routes/index.js';
import multer from 'multer';
import { uploadToBackblazeB2, uploadMultipleToBackblazeB2 } from './utils/uploadFile.js';
import { initSocket } from './socket.js';
import http from 'http';

dotenv.config();
connectDB();

// const numCPUs = os.cpus().length; // Get the number of CPU cores

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// Make io accessible globally for controllers
global.io = io;

// Middleware
app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 200 * 1024 * 1024 }
});

// Routes
app.get('/', (req, res) => {
    return res.send('API is running...');
})
app.use('/api/v1', defaultRoutes);

// Single file upload route
app.post('/api/v1/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const file = await uploadToBackblazeB2(req.file);

        return res.json({ message: 'File uploaded successfully', data: file, status: true });
    } catch (error) {
        res.status(500).send('Error uploading file.');
    }
});

// Multiple files upload route
app.post('/api/v1/upload-multiple', upload.array('files', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                status: false,
                message: 'No files uploaded.',
                data: null
            });
        }

        const uploadedFiles = await uploadMultipleToBackblazeB2(req.files);

        return res.json({ 
            status: true,
            message: `${uploadedFiles.length} files uploaded successfully`, 
            data: uploadedFiles 
        });
    } catch (error) {
        console.error('Error uploading multiple files:', error);
        res.status(500).json({
            status: false,
            message: 'Error uploading files.',
            data: null
        });
    }
});

// Function to start the server (used by workers)
const startServer = () => {
    const PORT = process.env.PORT || 5000;

    server.listen(PORT, () => console.log(`Server running on port ${PORT}, Worker: ${process.pid}`));
};

// if (cluster.isMaster) {
//   console.log(`Master process ${process.pid} is running`);

//   for (let i = 0; i < numCPUs; i++) {
//     cluster.fork();
//   }

//   cluster.on('exit', (worker, code, signal) => {
//     console.log(`Worker ${worker.process.pid} died, restarting...`);
//     cluster.fork();
//   });
// } else {
startServer();
// }
