const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('./models/User');
const Project = require('./models/Project');
const Option = require('./models/Option');
const app = express();

// .env fajl
require('dotenv').config();

// Povezivanje na MongoDB
mongoose.connect(process.env.DB_URI, {
    useUnifiedTopology: true,
})
    .then(() => console.log('Povezivanje sa bazom je uspelo!'))
    .catch((err) => console.log('Greška pri povezivanju sa bazom:', err));

// Middleware za sesiju
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: { secure: process.env.NODE_ENV === 'production' }  // Ako koristiš HTTPS u produkciji
}));

// Postavljanje EJS kao templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Postavljanje statičkih fajlova
app.use(express.static(path.join(__dirname, 'public')));

// Middleware za parsiranje tela zahteva
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Provera da li je korisnik prijavljen
function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// Multer konfiguracija za upload slika
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Ruta za prijavu
app.get('/login', (req, res) => {
    res.render('login');
});

// Ruta za autentifikaciju
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    User.findOne({ username: username }, (err, user) => {
        if (err || !user || user.password !== password) {
            return res.render('login', { error: 'Neispravno korisničko ime ili lozinka' });
        }
        req.session.user = user;
        res.redirect('/');
    });
});

// Ruta za odjavu
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});

// Ruta za početnu stranicu
app.get('/', ensureAuthenticated, (req, res) => {
    res.render('index', { user: req.session.user });
});

// Ruta za dodavanje novog projekta
app.get('/project/add', ensureAuthenticated, (req, res) => {
    res.render('add-project');
});

app.post('/project/add', ensureAuthenticated, (req, res) => {
    const { title, description } = req.body;

    const newProject = new Project({
        title,
        description,
        userId: req.session.user._id
    });

    newProject.save()
        .then(() => res.redirect('/'))
        .catch((err) => res.render('add-project', { error: 'Greška pri dodavanju projekta' }));
});

// Ruta za upload slike za projekat
app.post('/project/:id/upload', ensureAuthenticated, upload.single('image'), (req, res) => {
    const projectId = req.params.id;
    const imageUrl = `/uploads/${req.file.filename}`;

    Project.findByIdAndUpdate(projectId, { imageUrl }, { new: true })
        .then(() => res.redirect(`/project/${projectId}`))
        .catch((err) => res.redirect('/'));
});

// Ruta za prikaz projekata
app.get('/project/:id', ensureAuthenticated, (req, res) => {
    const projectId = req.params.id;

    Project.findById(projectId).populate('userId').exec((err, project) => {
        if (err || !project) {
            return res.redirect('/');
        }

        res.render('project', { project });
    });
});

// Ruta za dodavanje opcija unutar projekta
app.get('/project/:projectId/option/add', ensureAuthenticated, (req, res) => {
    const projectId = req.params.projectId;

    res.render('add-option', { projectId });
});

app.post('/project/:projectId/option/add', ensureAuthenticated, (req, res) => {
    const projectId = req.params.projectId;
    const { optionTitle } = req.body;

    const newOption = new Option({
        title: optionTitle,
        projectId: projectId
    });

    newOption.save()
        .then(() => res.redirect(`/project/${projectId}`))
        .catch((err) => res.render('add-option', { error: 'Greška pri dodavanju opcije', projectId }));
});

// Pokretanje servera
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server je pokrenut na portu ${port}`);
});
