import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createClient } from 'redis';  // Redis 4.x klijent
import RedisStore from 'connect-redis';  // connect-redis 7.x verzija

const app = express();
const port = 3000;

// Kreiraj Redis klijent
const redisClient = createClient({
  socket: {
    host: 'localhost', // Adresa Redis servera
    port: 6379,        // Podrazumevani port za Redis
     connectTimeout: 10000  // 10 sekundi timeout
  },
  // Opcionalno: Podesi autentifikaciju ako koristiš Redis sa password-om
  // password: 'your_redis_password'
});

// Poveži se sa Redis serverom
redisClient.connect().catch((err) => console.error('Greška pri povezivanju sa Redisom:', err));

// Konfiguracija sesije sa RedisStore
app.use(session({
  store: new RedisStore({ client: redisClient }),  // Povezivanje sa Redis store
  secret: 'your_session_secret',                   // Tajni ključ za sesije
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Ako koristiš HTTPS, postavi `secure: true`
}));

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

// Podesavanje view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware da bi se user prosledio u svaki ejs fajl
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;  // Prosleđujemo user iz sesije
  next();
});

// Povećanje timeout-a na Express serveru
app.use((req, res, next) => {
  res.setTimeout(5000, () => { // 5 sekundi timeout
    console.log('Request timed out');
    res.sendStatus(504);
  });
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

// Kreiranje projekta
app.get('/project/:projectId/option/:optionName/edit/:postId', ensureAuthenticated, (req, res) => {
  const { projectId, optionName, postId } = req.params;
  const project = projects.find(p => p.id == projectId);  // Pronađi projekat po ID
  const option = project.options.find(o => o.name === optionName);  // Pronađi opciju po imenu
  const post = option.posts.find(p => p.id == postId);  // Pronađi post po ID

  if (post) {
    res.render('edit', { 
      post: post,
      projectId: projectId,
      optionName: optionName
    });
  } else {
    res.redirect('/');  // Ako post ne postoji, redirektuj korisnika na početnu stranicu
  }
});

// Obrada POST zahteva za editovanje posta
app.post('/project/:projectId/option/:optionName/edit/:postId', upload.single('imageUrl'), (req, res) => {
  const { projectId, optionName, postId } = req.params;
  const { title, content } = req.body;  // Novi naslov i sadržaj
  let imageUrl = req.file ? `/uploads/${req.file.filename}` : null;  // Ako je nova slika uploadovana, uzmi njenu putanju

  const project = projects.find(p => p.id == projectId);  // Pronađi projekat po ID
  if (!project) {
    return res.redirect('/');  // Ako projekat nije pronađen, redirektuj
  }

  const option = project.options.find(o => o.name === optionName);  // Pronađi opciju po imenu
  if (!option) {
    return res.redirect('/');  // Ako opcija nije pronađena, redirektuj
  }

  const post = option.posts.find(p => p.id == postId);  // Pronađi post po ID
  if (post) {
    post.title = title;  // Ažuriraj naslov posta
    post.content = content;  // Ažuriraj sadržaj posta
    post.imageUrl = imageUrl || post.imageUrl;  // Ako nova slika nije postavljena, ostavi staru
  }

  res.redirect(`/project/${projectId}/${optionName}`);  // Nakon editovanja, redirektuj korisnika na stranicu opcije
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

// Kreiranje projekta
app.get('/create-project', ensureAuthenticated, (req, res) => {
  res.render('create-project', { error: null });
});

app.post('/create-project', (req, res) => {
  const { name, description, options } = req.body;

  console.log(options);

  let optionObjects = [];

  for (let i = 0; i < options.length; i++) {
    let optionName = options[i];

    if (i !== options.length - 1)
      optionObjects.push({ name: optionName, posts: [] });
    else
      optionObjects.push({ name: optionName, posts: [] });
  }

  // Provera da li projekat sa istim imenom već postoji
  const projectExists = projects.some(project => project.name.toLowerCase() === name.toLowerCase());

  if (projectExists) {
    // Ako projekat već postoji, vraćamo korisnika sa porukom o grešci
    return res.render('projects', {
      message: 'Projekat sa ovim imenom već postoji!',
      projects
    });
  }

  // Kreiranje novog projekta
  const newProject = {
    id: projects.length + 1,
    name: name,
    description: description,
    options: optionObjects,
    posts: [] // Prazan niz za projekte
  };

  // Dodavanje projekta u niz projects
  projects.push(newProject);

  // Snimanje projekta u JSON fajl
  fs.writeFile(path.join(__dirname, 'projekat.json'), JSON.stringify(projects, null, 2), 'utf-8', (err) => {
    if (err) {
      console.error('Greška pri upisivanju u fajl:', err);
    } else {
      console.log('Podaci uspešno upisani u projekat.json');
      // Nakon uspešnog dodavanja, redirektujemo korisnika na listu projekata
      res.redirect('/projects');
    }
  });
});

// Ruta za prikazivanje postova za određenu opciju
app.get('/project/:id/:option', ensureAuthenticated, (req, res) => {
  const projectId = parseInt(req.params.id);
  const optionName = req.params.option.replace(/-/g, " ");

  const project = projects.find(p => p.id === projectId);

  if (project) {
    const option = project.options.find(o => o.name === optionName);

    if (option) {
      res.render('project-option', { project, option });
    } else {
      return res.status(404).send('Option not found');
    }
  } else {
    return res.status(404).send('Project not found');
  }
});

// Logout korisnika
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Pokretanje servera (samo jednom)
app.listen(port, () => {
  console.log(`Server radi na http://localhost:${port}`);
});
