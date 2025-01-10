import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ObjectId } from 'mongodb';  // Uključi ovo ako koristiš MongoDB bez Mongoose
import methodOverride from 'method-override';
import bcrypt from 'bcrypt';
import he from 'he';  // za encoding HTML karaktera
// Preporučeni način upotrebe

const app = express();

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
    options: [optionSchema],
    username: { type: String, required: true },  // Dodano polje za korisničko ime
    createdAt: { type: Date, default: Date.now }  // Automatski se postavlja trenutni datum 
});

const Project = mongoose.model('Project', projectSchema);

const userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
});

const User = mongoose.model('User', userSchema);


const port = process.env.PORT;

// Inicijalizacija za ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


//midleware za upload slike
// Middleware za greške kod upload-a





function multerErrorHandling(err, req, res, next) {

    

    // Ako je greška zbog prevelikog fajla
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            // Prosleđujemo podatke o projektu i opciji u render funkciji
            return res.render('large-image', { 
                message: 'Slika je prevelika, maksimalna veličina je 2MB.',
               
            });
        }
    } else if (err) {
        return res.render('large-image', { 
            message: 'Došlo je do greške prilikom upload-a fajla.',
           
        });
    }
    next(); // Ako nema greške, idemo dalje
}




// Set up multer for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'public', 'uploads'));  // Ensure the images are stored here
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));  // Unique filename based on timestamp
    }
});

//stari kod za  - > const upload = multer({ storage: storage });
//novi kod za ogranicenje slike za upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // Postavite maksimalnu veličinu na 2MB
});//.single('imageUrl');



// Middleware za parsiranje POST podataka
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
  

//generisanje novih i kontrola postojecih korisnika u bazi
async function generateEncryptedPasswords() {
    const saltRounds = 10;
    // Provera da li su varijable okruženja postavljene
    const users = [
        process.env.USER_1,
        process.env.USER_2,
        process.env.USER_3,
        process.env.USER_4,
        process.env.USER_5,
        process.env.USER_6,
        process.env.USER_7,
        process.env.USER_8
    ];
    const passwords = [
        process.env.PASSWORD_1,
        process.env.PASSWORD_2,
        process.env.PASSWORD_3,
        process.env.PASSWORD_4,
        process.env.PASSWORD_5,
        process.env.PASSWORD_6,
        process.env.PASSWORD_7,
        process.env.PASSWORD_8
    ];

    // Proveri ako varijable okruženja nisu postavljene
    if (users.some(user => !user) || passwords.some(password => !password)) {
        console.log('Greška: Neke od varijabli okruženja nisu postavljene.');
        return;
    }

    // Pretraži sve korisnike u bazi
    const existingUsers = await User.find();

    // Kreiraj nove korisnike samo ako nisu pronađeni korisnici u bazi
    for (let i = 0; i < users.length; i++) {
        // Proveri da li korisnik već postoji u bazi
        const userExists = existingUsers.some(user => user.username === users[i]);

        if (userExists) {
            console.log(`Korisnik ${users[i]} već postoji u bazi, preskočen je.`);
            continue;  // Preskoči kreiranje korisnika
        }

        try {
            const hashedPassword = await bcrypt.hash(passwords[i], saltRounds);
            const newUser = new User({
                username: users[i],
                password: hashedPassword,
            });

            // Sačuvaj novog korisnika u bazi
            await newUser.save();
            console.log(`Korisnik ${users[i]} je uspešno sačuvan sa šifrovanim lozinkama.`);
        } catch (error) {
            console.error(`Greška prilikom dodavanja korisnika ${users[i]}:`, error);
        }
    }

    console.log('Generisanje korisnika je završeno.');
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
    const nameRegex1 =/^[A-Za-z0-9+,\-!@\?;:.()'" ]+$/;
    

    if (!nameRegex1.test(username) || !nameRegex1.test(password)) {
        return res.render('login', { message: '< > Not allowed for Password and Username' });
    } else {
        next();
    }
};



// Middleware za validaciju unosa pri kreiranju projekta
const validateProjectFields = (req, res, next) => {
    const { name, description } = req.body;

    // Regularni izraz za ime projekta (samo alfanumerički karakteri, razmaci, i neki specijalni karakteri)
    const nameRegex = /^[A-Za-z0-9\s\-\_\&\+\,\.]+$/;

    if (!nameRegex.test(name)) {
        return res.render('create-project', {
            message: 'Ime projekta može sadržavati samo slova, brojeve, i sledeće specijalne karaktere: -, _, &, +, , .'
        });
    }

    // Skrivanje potencijalno opasnih HTML karaktera
    req.body.name = he.encode(name);
    req.body.description = he.encode(description); // Encoding opasnih karaktera u opis

    next();  // Ako je sve u redu, ide dalje
};

// Middleware za validaciju i sanitizaciju post podataka
const validatePostFields = (req, res, next) => {
    const { title, content } = req.body;

    // Proveravamo da li su oba polja popunjena
    if (!title || !content) {
        return res.render('option-post', { message: 'Title and Content are required.' });
    }

    // Sanitizacija - pretvaranje specijalnih HTML karaktera u HTML entitete
    req.body.title = he.encode(title);  // Sanitizuje title
    req.body.content = he.encode(content);  // Sanitizuje content

    next();  // Poziva sledeći middleware ili glavnu funkciju rute
};

//function to get real user name
// Funkcija koja će biti dostupna svim EJS fajlovima
function getRealUserName(userName,num) {
    if(userName == process.env.USER_1 && num==1)
        return "Poštovanje Danijele, ";
    else if(userName == process.env.USER_1 && num==2)
        return "Danijel Udovičić";
    else if(userName == process.env.USER_2 && num==1)
        return "Poštovanje Alene, ";
    else if(userName == process.env.USER_2 && num==2)
        return "Alen Husić";
    else if(userName == process.env.USER_3 && num==1)
        return "Poštovanje Nenade, ";
    else if(userName == process.env.USER_3 && num==2)
        return "Nenad Malinović";
    else if(userName == process.env.USER_4 && num==1)
        return "Poštovanje Zahiru, ";
    else if(userName == process.env.USER_4 && num==2)
        return "Zahir Šabanović";
    else if(userName == process.env.USER_5 && num==1)
        return "Poštovanje Vasiljeviću, " ;
    else if(userName == process.env.USER_5 && num==2)
        return "Danijel Vasiljević" ;
    else if(userName == process.env.USER_6 && num==1)
        return "Poštovanje Katarina, ";
    else if(userName == process.env.USER_6 && num==2)
        return "Katarina Pepić";
    else if(userName == process.env.USER_7 && num==1)
        return "Poštovanje Luka, ";
    else if(userName == process.env.USER_7 && num==2)
        return "Luka Nikolić";
    else if(userName == process.env.USER_8 && num==1)
        return "Poštovanje Nataša, ";
    else if(userName == process.env.USER_8 && num==2)
        return "Nataša Maksimović";
    else
        return "";
        
}

// Middleware koji dodaje funkcije u res.locals
app.use((req, res, next) => {
    res.locals.getRealUserName = getRealUserName;  // Funkcija je dostupna u svim EJS fajlovima
    next();  // Nastavi sa izvršenjem sledeće middleware funkcije
});


//end of function for real user name


// Početna stranica
app.get('/',(req, res) => {
    //res.render('index');
     // Proverite da li je korisnik prijavljen (preko sesije)
     const user = req.session.user;

     // Renderujte početnu stranicu i prosleđujte podatke o korisniku
     res.render('index', { user });
});




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



// Kreiranje projekta
app.get('/create-project', ensureAuthenticated, (req, res) => {
    res.render('create-project', { message:'' });
});

app.post('/create-project',validateProjectFields, async (req, res) => {
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
        options: optionObjects,
        username: req.session.user,  // Čuvanje korisničkog imena
        createdAt: new Date()        // Čuvanje datuma kreiranja
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
app.get('/project/:projectId/:optionName/create-post',
     ensureAuthenticated, async (req, res) => {
    const { projectId, optionName } = req.params;
    const project = await Project.findById(projectId);

    if (!project) return res.status(404).send('Projekt nije pronađen');

    const option = project.options.find(o => o.name === optionName);
    if (!option) return res.status(404).send('Opcija nije pronađena');

    
    

    res.render('option-posts', { project, option ,message:'' });
});

app.post('/project/:projectId/option/:optionName/create-post', 
    upload.single('imageUrl'),  // Multer middleware za upload slike
    validatePostFields,  // Tvoj middleware za validaciju polja
    multerErrorHandling, //Midleware za velicinu slike
    async (req, res) => {
        const { projectId, optionName } = req.params;
        const { title, content } = req.body;
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;  // Slika ako postoji

        // Pronađi projekat na osnovu ID-a
        const project = await Project.findById(projectId);
        if (!project) {
            return res.render('option-posts', { message: 'Projekt nije pronađen' });
        }

        // Pronađi opciju unutar projekta
        const option = project.options.find(o => o.name === optionName);
        if (!option) {
            return res.render('option-posts', { message: 'Opcija nije pronađena' });
        }

        // Kreiraj novi post
        const newPost = {
            title,
            content,
            imageUrl,
            date: new Date()
        };

        // Dodaj post u opciju
        option.posts.push(newPost);
        await project.save();  // Spasi promene u bazi

        // Prebaci korisnika na stranicu sa svim postovima te opcije
        res.redirect(`/project/${project.id}/${option.name}`);
    }
);
//kraj kreiranja posta




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

app.post('/project/:projectId/option/:optionName/edit/:postId', upload.single('imageUrl'),
 validatePostFields,multerErrorHandling, async (req, res) => {
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




//kraj editovanja posta

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


// Logout korisnika
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});



// Pokretanje servera
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
})
