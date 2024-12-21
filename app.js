import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Inicijalizacija za ES module
const app = express();

// Dummy korisnici
const users = [
    { username: 'QS09', password: 'QSTeam2025' },
    { username: 'user2', password: 'password2' },
    { username: 'user3', password: 'password3' }
];

// Popunjavanje projekata iz JSON fajla
let projects = [];
const projectsFilePath = path.join(__dirname, 'projekat.json');

if (fs.existsSync(projectsFilePath)) {
    const data = fs.readFileSync(projectsFilePath, 'utf-8');
    projects = JSON.parse(data);
} else {
    projects = [];
}

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Konfiguracija za express-session sa dodatnim podešavanjima za kolačiće
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true,
        sameSite: 'strict'
    }
}));

// Middleware da bi se user prosledio u svaki ejs fajl
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Middleware za proveru prijavljenosti korisnika
function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/login');
    }
}

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

app.post('/create-project', (req, res) => {
    const { name, description, options } = req.body;
    let optionObjects = [];
    for (let i = 0; i < options.length; i++) {
        let optionName = options[i];
        optionObjects.push({ name: optionName, posts: [] });
    }

    const projectExists = projects.some(project => project.name.toLowerCase() === name.toLowerCase());
    if (projectExists) {
        return res.render('projects', {
            message: 'Projekat sa ovim imenom već postoji!',
            projects
        });
    }

    const newProject = {
        id: projects.length + 1,
        name: name,
        description: description,
        options: optionObjects,
        posts: []
    };

    projects.push(newProject);

    fs.writeFile(path.join(__dirname, 'projekat.json'), JSON.stringify(projects, null, 2), 'utf-8', (err) => {
        if (err) {
            console.error('Greška pri upisivanju u fajl:', err);
        } else {
            console.log('Podaci uspešno upisani u projekat.json');
            res.redirect('/projects');
        }
    });
});

// Projekti
app.get('/projects', ensureAuthenticated, (req, res) => {
    res.render('projects', { projects });
});

// Detalji o projektu
app.get('/project/:id', ensureAuthenticated, (req, res) => {
    const project = projects.find(p => p.id === parseInt(req.params.id));
    if (project) {
        res.render('project-details', { project });
    } else {
        res.status(404).send('Projekt nije pronađen.');
    }
});

// Kreiranje posta za opciju
app.get('/project/:projectId/:optionName/create-post', ensureAuthenticated, (req, res) => {
    const { projectId, optionName } = req.params;
    const project = projects.find(p => p.id === parseInt(projectId));
    if (!project) {
        return res.status(404).send('Projekt nije pronađen');
    }
    const option = project.options.find(o => o.name === optionName);
    if (!option) {
        return res.status(404).send('Opcija nije pronađena');
    }
    res.render('option-posts', { project, option });
});

app.post('/project/:projectId/option/:optionName/create-post', multer({ dest: 'public/uploads/' }).single('imageUrl'), (req, res) => {
    const { projectId, optionName } = req.params;
    const { title, content } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const project = projects.find(p => p.id === parseInt(projectId));
    if (!project) {
        return res.status(404).send('Projekt nije pronađen');
    }
    const option = project.options.find(o => o.name === optionName);
    if (!option) {
        return res.status(404).send('Opcija nije pronađena');
    }

    const newPost = {
        id: option.posts.length + 1,
        title,
        content,
        imageUrl,
        date: new Date()
    };

    option.posts.push(newPost);

    res.redirect(`/project/${project.id}/${option.name}`);
});

// Logout korisnika
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Eksportuj server kao serverless funkciju
export default app;
