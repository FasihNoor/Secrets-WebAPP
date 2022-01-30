//jshint esversion:6
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");


const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require("mongoose-findorcreate");
// const encrypt = require("mongoose-encryption");
//const md5 = require("md5");
/*
const bcrypt = require("bcrypt");
const saltRounds = 10;
*/

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended:true}));


app.use(session({ //Use session 
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize()); //Use and initilize passport
app.use(passport.session()); //Use passport for sessions 


mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});
//mongoose.set("useCreateIndex", true); // Not needed 

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose); // Adding the passportLocalMongoose plugin. 
userSchema.plugin(findOrCreate); // Adding the plugin for findorcreate

/*
                        ////////// Password Encryption//////////
userSchema.plugin(encrypt, {secret: process.env.SECRET, encryptedFields:["password"]}); //Adding the plugin and only encrypting the password
//process.env.SECRET grabs the secret from the .env file. 

*/

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user);
  });
   
  passport.deserializeUser(function(user, done) {
    done(null, user);
  });


passport.use(new GoogleStrategy({ //Google Auth
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo" 
  },
  function(accessToken, refreshToken, profile, cb) {
      console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/", function(req,res){
    res.render("home.ejs");
} )

app.get("/auth/google", passport.authenticate('google', {scope: ['profile']})); //Authenticating using the google strategy. 

app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect('/secrets');
  });

app.get("/login", function(req,res){
    res.render("login.ejs");
} )

app.get("/register", function(req,res){
    res.render("register.ejs");
} )

app.get("/secrets", function(req,res){


    User.find({"secret":{$ne:null}}, function(err, foundUsers){ //Find the users where the secret field is filled in.
        if(err){
            console.log(err);
        }
        else{
            if(foundUsers){
                res.render("secrets", {usersWithSecrets: foundUsers})
            }
        }
    }) //Check to see if the secret field is populated

   
})

app.get("/submit", function(req,res){
    if(req.isAuthenticated()){ //If the user is authenticated
        res.render("submit.ejs");
    }
    else{
        res.redirect("/login");
    }
})

app.post("/submit", function(req,res){
    const submittedSecret = req.body.secret;
    console.log(req.user.username);

    User.findById(req.user._id, function(err, foundUser){
        if(err){
            console.log(err)
        }
        else{
            if(foundUser){
                foundUser.secret = submittedSecret;
                foundUser.save(function(){
                    res.redirect("/secrets")
                })
            }
        }
    })

});

app.get("/logout", function(req,res){
    req.logOut();
    res.redirect("/");
})

app.post("/register", function(req,res){

    User.register({username: req.body.username}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect("/register")
        }
        else{
            passport.authenticate("local")(req,res, function(){ //Authenticating the user
                res.redirect("/secrets")
            })
        }
    })

    
    // const username = req.body.username;
    // const password = req.body.password;

    // bcrypt.hash(password, saltRounds, function(err, hash) { //Using bcrypt to hash the password 
    //     const newUser = new User({
    //         username: username,
    //         password: hash
    //     })

    //     newUser.save(function(err){
    //         if(!err){
    //             res.render("secrets.ejs");
    //         }
    //         else{
    //             console.log(err);
    //         }
    //     });



    });


app.post("/login", function(req,res){

    const user = new User({ //Creating the user that wants to log in. 
        username: req.body.username,
        password: req.body.password,
    })

    req.login(user, function(err){
        if(err){
            console.log(err);
        }
        else{
            passport.authenticate("local")(req,res, function(){ //Authenticating the User 
                res.redirect("/secrets")
            })
        }
    })













    // const username = req.body.username;
    // const password = req.body.password;

    // User.findOne({username: username}, function(err,foundUser){
    //     if(err){
    //         console.log(err);
    //     }
    //     else{
    //         if(foundUser){
    //             bcrypt.compare(password, foundUser.password, function(err, result) {
    //                 if(result === true){
    //                 res.render("secrets")
    //                 }
    //                 else{
    //                     res.send("Password doesn't match")
    //                 }
    //             });    
    //             }
    //         else{
    //             res.send("No User Found")
    //         }
    //     }

    // })
});

app.listen(3000, function() {
    console.log("Server started on port 3000");
  });