const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db'); // Intializes DB automatically
const { initCrons } = require('./crons');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Background Workers (Final Yr Proj Feature)
initCrons();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Example basic route
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Online Assignment System API is running.' });
});

// Import Routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const featuresRoutes = require('./routes/features');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api', featuresRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
