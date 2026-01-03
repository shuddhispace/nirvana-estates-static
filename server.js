require('dotenv').config();
const express = require('express');
const app = express();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static folders
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use(express.static('public'));

const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

const Property = require("./models/Property");

['public/uploads/images'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const cors = require("cors");

app.use(cors({
  origin: [
    "https://nirvana-estates-static.onrender.com",
    "https://nirvanaestates.co.in",
    "https://nirvana-estates-backend.onrender.com"
  ],
  methods: ["GET", "POST", "DELETE"],
}));


const uploadDir = path.join(__dirname, "public/uploads/images");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Admin upload route (Updated for YouTube Shorts only)
app.post('/admin/upload-property', upload.array('images', 10), async (req, res) => {
  try {
    // ✅ Move console.log inside route
    console.log("REQ.BODY:", req.body);
    console.log("REQ.FILES:", req.files);

    const {
      title, price, location, bedrooms, bathrooms,
      description, category, carpetArea, builtupArea, videos
    } = req.body;

    const negotiable = req.body.negotiable === 'on';

    // Handle image uploads
    const BASE_URL = process.env.BASE_URL || 'https://nirvana-estates-backend.onrender.com';
    const images = req.files
      ? req.files.map(f => `${BASE_URL}/uploads/images/${f.filename}`)
      : [];

    // Handle YouTube video URLs
let videoLinks = [];
if (req.body.videos) {
  if (Array.isArray(req.body.videos)) {
    videoLinks = req.body.videos.filter(v => v && v.trim() !== '');
  } else if (req.body.videos.trim() !== '') {
    videoLinks = [req.body.videos.trim()];
  }
}


    // ✅ Safe number parsing
    const property = {
      title,
      price: Number(price) || 0,
      negotiable,
      location,
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      description,
      category,
      carpetArea: Number(carpetArea) || 0,
      builtupArea: Number(builtupArea) || 0,
      images,
      videos: videoLinks,
    };

    console.log("Parsed property object:", property);

    await Property.create(property);

    res.send("Property uploaded successfully (YouTube Shorts version)!");
  } catch (err) {
  console.error("Upload Error:", err);
  res.status(500).json({ success: false, message: "Error uploading property.", error: err.message });
}

});

// Delete property by ID
app.delete('/admin/delete-property/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findById(id);
    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Delete images from disk
    if (property.images) {
      property.images.forEach(imgUrl => {
        const filename = imgUrl.split('/uploads/images/')[1];
        if (!filename) return;

        const fullPath = path.join(__dirname, 'public/uploads/images', filename);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      });
    }

    await Property.findByIdAndDelete(id);

    res.json({ success: true, message: "Property deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});


app.post("/api/seller", async (req, res) => {
  try {
    const { name, phone, email, type, location, description } = req.body;

    console.log("New Seller Lead:", req.body);

    // Later you can:
    // 1. Save to MongoDB
    // 2. Send email via Nodemailer

    // res.json({ success: true, message: "Seller data received" });
    res.status(201).json({ success: true, message: "Seller data received" });
  } catch (err) {
    console.error("Seller Error:", err);
    res.status(500).json({ success: false });
  }
});

// Existing seller form route and sitemap unchanged...

// Dynamic sitemap.xml route
app.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrls = [
      'https://nirvanaestates.co.in/',
      'https://nirvanaestates.co.in/about.html',
      'https://nirvanaestates.co.in/contact.html',
      'https://nirvanaestates.co.in/properties.html'
    ];

    const properties = await Property.find({}, "_id");

    const propertyUrls = properties.map(p =>
      `https://nirvanaestates.co.in/property-details.html?id=${p._id}`
    );

    const urls = [...baseUrls, ...propertyUrls];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error generating sitemap');
  }
});

app.get("/api/properties", async (req, res) => {
  try {
    const properties = await Property.find().sort({ createdAt: -1 });
    res.json(properties);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
