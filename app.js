import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import fs from 'fs';  // Dodajte ovo na vrh fajla zajedno sa ostalim importima
import mongoose from 'mongoose';

// Povezivanje sa MongoDB
mongoose.connect('your-mongodb-uri', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Povezivanje sa MongoDB uspesno!');
}).catch((error) => {
    console.error('Greška pri povezivanju sa MongoDB:', error);
});

// Definicija modela za Post, Option i Project
const postSchema = new mongoose.Schema({
    title: String,
    content: String,
    imageUrl: String,
    date: { type: Date, default: Date.now }
});

const optionSchema = new mongoose.Schema({
    name: String,
    posts: [postSchema]
});

const projectSchema = new mongoose.Schema({
    name: String,
    description: String,
    options: [optionSchema]
});

const Project = mongoose.model('Project', projectSchema);

const app = express();
const port = 3000;

// Inicijalizacija za ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up multer for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'uploads'));  // Ensure the images are stored here
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // Unique filename based on timestamp
    }
});

const upload = multer({ storage: storage });

// Dummy korisnici
const users = [
    { username: 'QS09', password: 'QSTeam2025' },
    { username: 'user2', password: 'password2' },
    { username: 'user3', password: 'password3' }
];

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true
}));

// Podesavanje view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware da bi se user prosledio u svaki ejs fajl
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;  // Prosleđujemo user iz sesije
    next();
});

// Middleware za proveru prijavljenosti korisnika
function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();  // Ako je korisnik prijavljen, nastavi dalje
    } else {
        res.redirect('/login');  // Ako nije prijavljen, preusmeri na login
    }
}

// Dodaj ovu middleware funkciju na svaku rutu gde je korisnik obavezan da bude prijavljen
app.get('/profile', ensureAuthenticated, (req, res) => {
    const additionalData = { title: 'Profile Page' };
    res.render('profile', { ...additionalData });
});

// Ruta za login stranicu
app.get('/login', (req, res) => {
    res.render('login', { message: '' });
});

// Ruta za obradu POST zahteva za login
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const foundUser = users.find(user => user.username === username && user.password === password);
    if (foundUser) {
        req.session.user = { username };
        res.redirect('/');  // Preusmeravanje na početnu stranicu
    } else {
        res.render('login', { message: 'Neispravni podaci!' });
    }
});

// Početna stranica
app.get('/',(req, res) => {
    res.render('index');
});

// Kreiranje projekta
app.get('/create-project', ensureAuthenticated, (req, res) => {
    res.render('create-project', { error: null });
});

app.post('/create-project', async (req, res) => {
    const { name, description, options } = req.body;

    let optionObjects = options.map(optionName => ({
        name: optionName,
        posts: []
    }));

    // Provera da li projekat sa istim imenom već postoji
    const projectExists = await Project.findOne({ name: name });

    if (projectExists) {
        return res.render('projects', {
            message: 'Projekat sa ovim imenom već postoji!'
        });
    }

    // Kreiranje novog projekta
    const newProject = new Project({
        name,
        description,
        options: optionObjects
    });

    await newProject.save();
    res.redirect('/projects');
});

// Projekti
app.get('/projects', ensureAuthenticated, async (req, res) => {
    const projects = await Project.find();
    res.render('projects', { projects });
});

// Detalji o projektu
app.get('/project/:id', ensureAuthenticated, async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (project) {
        res.render('project-details', { project });
    } else {
        res.status(404).send('Projekt nije pronađen.');
    }
});

// Ruta za prikazivanje postova za određenu opciju
app.get('/project/:projectId/:optionName/create-post', ensureAuthenticated, async (req, res) => {
    const { projectId, optionName } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).send('Projekt nije pronađen');

    const option = project.options.find(o => o.name === optionName);
    if (!option) return res.status(404).send('Opcija nije pronađena');

    res.render('option-posts', { project, option });
});

// Ruta za POST zahtev za kreiranje posta
app.post('/project/:projectId/option/:optionName/create-post', upload.single('imageUrl'), async (req, res) => {
    const { projectId, optionName } = req.params;
    const { title, content } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).send('Projekt nije pronađen');

    const option = project.options.find(o => o.name === optionName);
    if (!option) return res.status(404).send('Opcija nije pronađena');

    const newPost = {
        title,
        content,
        imageUrl,
        date: new Date()
    };

    option.posts.push(newPost);
    await project.save();

    res.redirect(`/project/${project.id}/${option.name}`);
});

// Editovanje postojećeg posta
app.post('/project/:projectId/option/:optionName/edit/:postId', upload.single('imageUrl'), async (req, res) => {
    const { projectId, optionName, postId } = req.params;
    const { title, content } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const project = await Project.findById(projectId);
    if (!project) return res.redirect('/');

    const option = project.options.find(o => o.name === optionName);
    if (!option) return res.redirect('/');

    const post = option.posts.find(p => p._id.toString() === postId);
    if (post) {
        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl || post.imageUrl;
        await project.save();
    }

    res.redirect(`/project/${projectId}/${optionName}`);
});

// Brisanje posta
app.post('/delete/:postId', async (req, res) => {
    const { postId } = req.params;
    const project = await Project.findOne({ 'options.posts._id': postId });

    if (project) {
        for (let option of project.options) {
            const postIndex = option.posts.findIndex(p => p._id.toString() === postId);
            if (postIndex !== -1) {
                option.posts.splice(postIndex, 1);
                await project.save();
                return res.redirect(`/project/${project.id}/${option.name}`);
            }
        }
    }

    res.redirect('/');
});

// Logout korisnika
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Pokretanje servera
app.listen(port, () => {
    console.log(`Server radi na http://localhost:${port}`);
});
