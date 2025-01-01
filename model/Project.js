import mongoose from 'mongoose';

// Definisanje schema za projekat
const projectSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    options: [
        {
            name: { type: String, required: true },
            posts: [
                {
                    title: String,
                    content: String,
                    imageUrl: String,
                    date: { type: Date, default: Date.now }
                }
            ]
        }
    ]
});

// Kreiranje modela na osnovu schema
const Project = mongoose.model('Project', projectSchema);

export default Project;