const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_dbms_project';

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: 'No token provided' });

    jwt.verify(token.replace('Bearer ', ''), JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Unauthorized' });
        req.userId = decoded.id;
        req.userRole = decoded.role_id;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.userRole !== 1) return res.status(403).json({ message: 'Require Admin Role' });
    next();
};

const isTeacher = (req, res, next) => {
    if (req.userRole !== 2) return res.status(403).json({ message: 'Require Teacher Role' });
    next();
};

const isStudent = (req, res, next) => {
    if (req.userRole !== 3) return res.status(403).json({ message: 'Require Student Role' });
    next();
};

module.exports = { verifyToken, isAdmin, isTeacher, isStudent, JWT_SECRET };
