import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
//import fs from 'fs';  // Dodajte ovo na vrh fajla zajedno sa ostalim importima
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';  // Uključi ovo ako koristiš MongoDB bez Mongoose
import methodOverride from 'method-override';
import bcrypt from 'bcrypt';
//import DOMPurify from 'dompurify';
//import { JSDOM } from 'jsdom';  // Potrebno za DOMPurify




// Učitavanje vrednosti iz .env fajla
dotenv.config();

// Povezivanje sa MongoDB koristeći vrednost iz .env fajla
const MONGODB_URI = process.env.MONGODB_URI;  // Dobijamo URI iz .env fajla



 mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');

    // Pozivanje funkcije za dodavanje korisnika u bazu samo ako su korisnici još uvek prazni
    generateEncryptedPasswords();    
  })
  .catch((err) => {
    console.error('Error connecting to MongoDB', err);
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
const port = 3001;

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


const passwords = ['QSTeam2025', 'password2', 'password3'];
const users = ['QS09','user2','user3']

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);


// Middleware za parsiranje POST podataka
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
  

// Funkcija za šifrovanje lozinki
async function generateEncryptedPasswords() {
    const saltRounds = 10;
    const users = [process.env.USER_1, process.env.USER_2, process.env.USER_3];
    const passwords = [process.env.PASSWORD_1, process.env.PASSWORD_2, process.env.PASSWORD_3];

    const existingUsers = await User.find(); // Pretraži sve korisnike u bazi

    if (existingUsers.length > 0) {
        console.log('Korisnici su već dodati u bazu.');  
        return;
    }

    for (let i = 0; i < users.length; i++) {
        const hashedPassword = await bcrypt.hash(passwords[i], saltRounds);
        const newUser = new User({
            username: users[i],
            password: hashedPassword,
        });

        await newUser.save();
    }

    console.log('Korisnici su uspešno dodati u bazu sa šifrovanim lozinkama');
}



// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

app.use(bodyParser.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'some-secure-random-string',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,  // Ovaj cookie je pristupačan samo putem HTTP (ne kroz JavaScript)
        secure: process.env.NODE_ENV === 'production',  // Samo u produkciji koristi Secure flag za HTTPS
        maxAge: 24 * 60 * 60 * 1000 // Setovanje isteka sesije na 24h
    }
}));

// Podesavanje view engine
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Middleware da bi se user prosledio u svaki ejs fajl
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;  // Prosleđujemo user iz sesije
    next();
});

// Omogućavanje method-override
app.use(methodOverride('_method'));

// Middleware za proveru prijavljenosti korisnika
function ensureAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();  // Ako je korisnik prijavljen, nastavi dalje
    } else {
        res.redirect('/login');  // Ako nije prijavljen, preusmeri na login
    }
}

//Midleware za provjeru validnosti polja
const validateLoginFields = (req, res, next) => {
    console.log('LOGIN VALIDATION!!!!')
    const username = req.body.username;
    const password = req.body.password;

    // Regularni izraz koji dozvoljava samo slova i razmake i brojeve
    const nameRegex1 =/^[A-Za-z0-9+,\-!\?;:.()'" ]+$/;
    

    if (!nameRegex1.test(username) || !nameRegex1.test(password)) {
        return res.render('login', { message: '< > Not allowed for Password and Username' });
    } else {
        next();
    }
};


// Ruta za login stranicu
app.get('/login', (req, res) => {
    res.render('login', { message: '' });
});

// Ruta za obradu POST zahteva za login
// Autentifikacija korisnika
app.post("/login",validateLoginFields, async (req, res) => {
    const { username, password } = req.body;

    // Pretraga korisnika u MongoDB-u
    const user = await User.findOne({ username: username });


    if (!user) {
        //return res.status(400).send('Korisnik nije pronađen');
        return res.render('login',{message:'Wrong password or username'});
        
    }

    // Proveri da li lozinka odgovara
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (isMatch) {
        req.session.user = username;  // Postavi korisnika u sesiju
        res.redirect('/');
    } else {
        return res.render('login', { message: 'Neispravni podaci!' });
    }
});


// Početna stranica
app.get('/',(req, res) => {
    res.render('index');
});

// Kreiranje projekta
app.get('/create-project', ensureAuthenticated, (req, res) => {
    res.render('create-project', { message:'' });
});

app.post('/create-project', async (req, res) => {
    const { name, description, options } = req.body;

    let optionObjects = options.map(optionName => ({
        name: optionName,
        posts: []
    }));

    // Normalizovanje unosa imena projekta na mala slova
    const normalizedProjectName = name.toLowerCase();

    // Provera da li projekat sa istim imenom već postoji (ignorisanjem velikih i malih slova)
    const projectExists = await Project.findOne({ 
        name: { $regex: new RegExp(`^${normalizedProjectName}$`, 'i') } 
    });

    if (projectExists) {
        return res.render('create-project', {
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



app.get('/project/:id/:option', ensureAuthenticated, (req, res) => {
    const projectId = req.params.id;  // Ovo je MongoDB ID
    const optionName = req.params.option.replace(/-/g, " ");  // Ovdje ide ime opcije

    // Upotrebi ObjectId za pretragu po MongoDB ID-u
    const objectId = new ObjectId(projectId);

    // Pronađi projekat sa tim ID-em
    Project.findOne({ _id: objectId })
        .then(project => {
            if (!project) {
                return res.status(404).send('Project not found');
            }

            // Pretraga opcije unutar projekta
            const option = project.options.find(o => o.name === optionName);
            
            if (option) {
                res.render('project-option', { project, option });  // Prikazivanje opcije
            } else {
                return res.status(404).send('Option not found');
            }
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Server error');
        });
});

//editovanje projekta 
app.get('/edit-project/:id', ensureAuthenticated, async (req, res) => {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).send('Projekt nije pronađen');

    res.render('edit-project', { project,message:'' });  // Pretpostavljam da imaš formu koja se prikazuje
});




app.post('/project/:id/edit', async (req, res) => {
    const projectId = req.params.id;
    console.log('Project ID:', projectId); // Logujemo ID projekta koji se uređuje

    try {
        // Pronalaženje projekta u bazi po ID-u
        const project = await Project.findById(projectId);
        console.log('Project found:', project); // Logujemo pronađeni projekat

        if (!project) {
            return res.status(404).send('Project not found');
        }

        // Logujemo podatke koji dolaze iz forme
        console.log('Options from form:', req.body.options); // Logujemo selektovane opcije
        console.log('New options from form:', req.body.newOption); // Logujemo novu opciju ako postoji

        // Dodavanje opcija sa forme
        if (req.body.options) {
            req.body.options.forEach(optionName => {
                // Proveravamo da li opcija već postoji
                if (!project.options.some(o => o.name === optionName)) {
                    console.log('Adding existing option:', optionName); // Logujemo koja opcija se dodaje
                    project.options.push({
                        name: optionName,
                        posts: []
                    });
                }
            });
        }

        // Dodavanje novih opcija (ako postoji)
        if (req.body.newOption) {
            const newOptions = req.body.newOption.split(',').map(opt => opt.trim());
            console.log('Parsed new options:', newOptions); // Logujemo nove opcije koje se unose
            newOptions.forEach(optionName => {
                if (!project.options.some(o => o.name === optionName)) {
                    console.log('Adding new option:', optionName); // Logujemo koja nova opcija se dodaje
                    project.options.push({
                        name: optionName,
                        posts: []
                    });
                }
            });
        }

        // Spremanje izmena u bazi
        await project.save();
        console.log('Project updated:', project); // Logujemo ažurirani projekat
        res.redirect(`/project/${project.id}`);
    } catch (err) {
        console.error('Error during update:', err); // Logujemo grešku ako nešto pođe po zlu
        return res.status(500).send('Error updating project');
    }
});

//kraj editovanja projekta

// Ruta za prikazivanje postova za određenu opciju
app.get('/project/:projectId/:optionName/create-post', ensureAuthenticated, async (req, res) => {
    const { projectId, optionName } = req.params;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).send('Projekt nije pronađen');

    const option = project.options.find(o => o.name === optionName);
    if (!option) return res.status(404).send('Opcija nije pronađena');

    res.render('option-posts', { project, option ,message:'' });
});

// Ruta za POST zahtev za kreiranje posta
app.post('/project/:projectId/option/:optionName/create-post',  upload.single('imageUrl'), async (req, res) => {
    const { projectId, optionName } = req.params;
    const { title, content } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    

    const project = await Project.findById(projectId);
    if (!project) 
    return res.render('option-post',{message:'No Project Found'});

    const option = project.options.find(o => o.name === optionName);
    if (!option) 
    return res.render('option-post',{message:'No Option Found'});

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
app.get('/project/:projectId/option/:optionName/edit/:postId', ensureAuthenticated, async (req, res) => {
    const { projectId, optionName, postId } = req.params;

    
    
    try {
        // Pretpostavljamo da se tvoji podaci nalaze u MongoDB-u
        const project = await Project.findById(projectId);
        const option = project.options.find(o => o.name === optionName);
        const post = option.posts.find(p => p.id == postId);

        console.log('Post content:', post.content);  // Proveri da li postoji sadržaj

        
        if (post) {
            res.render('edit', { 
                post: post,
                projectId: projectId,
                optionName: optionName
            });
        } else {
            res.redirect('/');  // Ako post ne postoji, redirektuj korisnika na početnu stranicu
        }
    } catch (error) {
        console.error('Greška pri preuzimanju podataka:', error);
        res.redirect('/');
    }
});

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
// Prikazivanje modalnog prozora za potvrdu brisanja posta
app.get('/project/:projectId/option/:optionName/delete/:postId', ensureAuthenticated, (req, res) => {
    const { projectId, optionName, postId } = req.params;

    // Pronaći projekat, opciju i post
    Project.findById(projectId)
        .then(project => {
            if (!project) return res.redirect('/'); // Ako projekat ne postoji, vratiti na početnu stranu

            const option = project.options.find(o => o.name === optionName);
            const post = option ? option.posts.find(p => p._id.toString() === postId) : null;

            if (post) {
                // Ako post postoji, prikazati modal
                res.render('modal', { post, project, option });
            } else {
                // Ako post nije pronađen, redirektovati korisnika na opciju
                res.redirect(`/project/${projectId}/option/${optionName}`);
            }
        })
        .catch(err => {
            console.error('Greška pri pronalaženju projekta:', err);
            res.redirect('/');
        });
});

// Obrada POST zahteva za brisanje posta
app.post('/project/:projectId/option/:optionName/delete/:postId', (req, res) => {
    const { projectId, optionName, postId } = req.params;
    console.log(`POST request received to delete post ${postId} in option ${optionName} of project ${projectId}`);

    Project.findById(projectId)
        .then(project => {
            if (!project) {
                console.error(`Project with ID ${projectId} not found`);
                return res.redirect('/');
            }

            const option = project.options.find(o => o.name === optionName);
            if (!option) {
                console.error(`Option with name ${optionName} not found in project ${projectId}`);
                return res.redirect(`/project/${projectId}`);
            }

            const postIndex = option.posts.findIndex(p => p._id.toString() === postId);
            if (postIndex !== -1) {
                console.log(`Post with ID ${postId} found. Deleting post...`);
                option.posts.splice(postIndex, 1);  // Brisanje posta
                return project.save()
                    .then(() => {
                        console.log(`Post with ID ${postId} deleted successfully`);

                        // Dodavanje loga pre redirekcije
                        console.log(`Redirecting to /project/${projectId}/option/${optionName}`);
                        
                        // Redirektuj na stranicu sa opcijom
                        //res.redirect(`/project/${projectId}/option/${optionName}`);
                        return res.redirect(`/project/${project.id}/${option.name}`);
                    })
                    .catch(err => {
                        console.error('Error while saving the project after deleting post:', err);
                        res.redirect(`/project/${projectId}/option/${optionName}`);
                    });
            } else {
                console.error(`Post with ID ${postId} not found in option ${optionName}`);
                res.redirect(`/project/${projectId}/option/${optionName}`);
            }
        })
        .catch(err => {
            console.error('Error while finding the project:', err);
            res.redirect('/');
        });
});

// Ruta za prikazivanje opcije u okviru projekta
app.get('/project/:projectId/option/:optionName', ensureAuthenticated, (req, res) => {
    const { projectId, optionName } = req.params;

    // Pronaći projekat u bazi
    Project.findById(projectId)
        .then(project => {
            if (!project) return res.redirect('/');  // Ako projekat ne postoji, vraća se na početnu

            // Pronaći opciju unutar projekta
            const option = project.options.find(o => o.name === optionName);
            if (!option) return res.redirect(`/project/${projectId}`);  // Ako opcija nije pronađena, vraća se na stranicu projekta

            // Renderovanje stranice sa opcijom
            res.render('option', { project, option });
        })
        .catch(err => {
            console.error('Greška pri pronalaženju projekta:', err);
            res.redirect('/');
        });
});


///////// ******* RUTA ZA BRISANJE PROJEKTA ***** /////////








///////// *******KRAJ RUTE ZA BRISANJE PROJEKTA ***** /////////




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