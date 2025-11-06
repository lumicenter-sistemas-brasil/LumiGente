const session = require('express-session');

const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'lumicenter-feedback-secret',
    resave: process.env.SESSION_RESAVE === 'true',
    saveUninitialized: process.env.SESSION_SAVE_UNINITIALIZED === 'true',
    name: 'lumigente.sid',
    cookie: {
        secure: process.env.SESSION_COOKIE_SECURE === 'true',
        httpOnly: process.env.SESSION_COOKIE_HTTPONLY === 'true',
        maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE) || 8 * 60 * 60 * 1000,
        sameSite: 'strict'
    },
    rolling: true
};

module.exports = session(sessionConfig);