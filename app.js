import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import fs from 'fs';
import cookie from 'cookie';

const app = express();
const port = 3000;

// Inicijalizacija za ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up multer for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'uploads'));  // Osiguraj da se slike čuvaju ovde
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // Unikatni naziv fajla baziran na vremenu
    }
});

const upload = multer({ storage: storage });

// Dummy korisnici
const users = [
    { username: 'QS09', password: 'QSTeam2025' },
    { username: 'user2', password: 'password2' },
    { username: 'user3', password: 'password3' }
];

let projects = [];

// Popunjavanje projekata iz JSON fajla
const projectsFilePath = path.join(__dirname, 'projekat.json');
if (fs.existsSync(projectsFilePath)) {
    const data = fs.readFileSync(projectsFilePath, 'utf-8');
    projects = JSON.parse(data);
}

// Middleware za sesiju
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
        return next();
    } else {
        res.redirect('/login');
    }
}

// Rute
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    res.render('login', { message: '' });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const foundUser = users.find(user => user.username === username && user.password === password);
    if (foundUser) {
        req.session.user = { username };
        res.redirect('/');
    } else {
        res.render('login', { message: 'Neispravni podaci!' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Projekti
app.get('/projects', ensureAuthenticated, (req, res) => {
    res.render('projects', { projects });
});

// Kreiranje projekta
app.get('/create-project', ensureAuthenticated, (req, res) => {
    res.render('create-project', { error: null });
});

app.post('/create-project', (req, res) => {
    const { name, description, options } = req.body;
    let optionObjects = options.map(optionName => ({ name: optionName, posts: [] }));

    const projectExists = projects.some(project => project.name.toLowerCase() === name.toLowerCase());
    if (projectExists) {
        return res.render('projects', { message: 'Projekat sa ovim imenom već postoji!', projects });
    }

    const newProject = { id: projects.length + 1, name, description, options: optionObjects, posts: [] };
    projects.push(newProject);

    fs.writeFile(path.join(__dirname, 'projekat.json'), JSON.stringify(projects, null, 2), 'utf-8', err => {
        if (err) {
            console.error('Greška pri upisivanju u fajl:', err);
        } else {
            console.log('Podaci uspešno upisani u projekat.json');
            res.redirect('/projects');
        }
    });
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
    const option = project?.options.find(o => o.name === optionName);

    if (option) {
        res.render('option-posts', { project, option });
    } else {
        res.status(404).send('Opcija nije pronađena');
    }
});

// Obrada POST zahteva za kreiranje posta
app.post('/project/:projectId/option/:optionName/create-post', upload.single('imageUrl'), (req, res) => {
    const { projectId, optionName } = req.params;
    const { title, content } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const project = projects.find(p => p.id === parseInt(projectId));
    const option = project?.options.find(o => o.name === optionName);

    if (option) {
        const newPost = { id: option.posts.length + 1, title, content, imageUrl, date: new Date() };
        option.posts.push(newPost);
        res.redirect(`/project/${project.id}/${option.name}`);
    } else {
        res.status(404).send('Opcija nije pronađena');
    }
});

// Editovanje posta
app.get('/project/:projectId/option/:optionName/edit/:postId', ensureAuthenticated, (req, res) => {
    const { projectId, optionName, postId } = req.params;
    const project = projects.find(p => p.id == projectId);
    const option = project?.options.find(o => o.name === optionName);
    const post = option?.posts.find(p => p.id == postId);

    if (post) {
        res.render('edit', { post, projectId, optionName });
    } else {
        res.redirect('/');
    }
});

// Obrada POST zahteva za editovanje posta
app.post('/project/:projectId/option/:optionName/edit/:postId', upload.single('imageUrl'), (req, res) => {
    const { projectId, optionName, postId } = req.params;
    const { title, content } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const project = projects.find(p => p.id == projectId);
    const option = project?.options.find(o => o.name === optionName);
    const post = option?.posts.find(p => p.id == postId);

    if (post) {
        post.title = title;
        post.content = content;
        post.imageUrl = imageUrl || post.imageUrl;
        res.redirect(`/project/${projectId}/${optionName}`);
    } else {
        res.redirect('/');
    }
});

// Brisanje posta
app.get('/project/:projectId/option/:optionName/delete/:postId', ensureAuthenticated, (req, res) => {
    const { projectId, optionName, postId } = req.params;
    const project = projects.find(p => p.id == projectId);
    const option = project?.options.find(o => o.name === optionName);
    const postIndex = option?.posts.findIndex(p => p.id == postId);

    if (postIndex !== undefined && postIndex !== -1) {
        option.posts.splice(postIndex, 1);
        res.redirect(`/project/${project.id}/${option.name}`);
    } else {
        res.redirect('/');
    }
});

// Pokretanje servera
app.listen(port, () => {
    console.log(`Server radi na http://localhost:${port}`);
});
