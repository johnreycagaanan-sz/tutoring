const Tutee = require('../models/Tutee');
const crypto = require('crypto');
const path = require('path');

const sendTokenResponse = (tutee, statusCode, res) => {
    const token = tutee.getSignedJwtToken();
    const options = {
        expires: new Date(Date.now()+process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true
    }

    if(process.env.NODE_ENV === 'production')  {
        options.secure = true
    }
    res
        .status(statusCode)
        .cookie('token', token, options)
        .json({success: true, token})
}

const login = async(req, res, next) => {
    const {userName, password } = req.body

    if(!userName || !password) throw new Error ('Please provide username and password')

    const tutee = await Tutee.findOne({userName}).select('+password')
    
    if(!tutee) throw new error ('Invalid credentials')

    const isMatch = await tutee.matchPassword(password);

    if(!isMatch) throw new Error('Invalid credentails')
    sendTokenResponse(tutee, 200, res)
}

const logout = async(req, res, next) => {
    res
        .status(200)
        .cookie('token', 'none', {
            expires: new Date(Date.now() + 10 * 1000),
            httpOnly: true
        })
        .json({success: true, msg: `Successfully logged out`})
    
        
}

const forgotPassword = async(req, res, next) => {
    const tutee = await Tutee.findOne({userName: req.body.userName})

    if(!tutee) throw new Error('No tutee found');

    const resetToken = tutee.getResetPasswordToken();

    try {
        await tutee.save({ validateBeforeSave: false })
        res
            .status(200)
            .setHeader('Content-Type', 'application/json')
            .json({succes: true, msg: `Password has been reset with token: ${resetToken}`})
    } catch (err) {
        tutee.resetPasswordToken = undefined;
        tutee.resetPasswordExpire = undefined;

        await tutee.save({ validateBeforeSave: false })
        throw new Error(`Failed to save new password`)
    }
}

const resetPassword = async(req, res, next) => {
    const resetPasswordToken = crypto.createHash('sha256').update(req.query.resetToken).digest('hex');
    console.log(resetPasswordToken)
    const tutee = await Tutee.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    })
    

    if(!tutee) throw new Error('Invalid token');

    tutee.password = req.body.password;
    tutee.resetPasswordExpire = undefined;
    tutee.resetPasswordToken = undefined;

    await tutee.save();

    sendTokenResponse(tutee, 200, res)
}

const updatePassword = async(req, res, next) => {
    const tutee = await Tutee.findById(req.tutee.id).select('+password');

    const passwordMatches = await tutee.matchPassword(req.body.password);

    if(!passwordMatches) throw new Error('Password is incorrect');
    tutee.password = req.body.newPassword

    await tutee.save();
    sendTokenResponse(tutee, 200, res)
}

const getTutees = async(req, res, next) => {
    const filter = {};
    const options = {};
    if (Object.keys(req.body).length){
        const {
            tuteeName,
            email,
            limit,
            sortByName
        } = req.query;
        
        if (tuteeName) filter.tuteeName = true;
        if (email) filter.email = true;

        if (limit) options.limit = limit;
        if (sortByName) options.sort = {
            name: sortByName === 'asc' ? 1: -1
        }

    }
    try {
        const tutees = await Tutee.find({}, filter, options);
        res
            .status(200)
            .setHeader('Content-Type', 'application/json')
            .json(tutees)
    } catch (err) {
        throw new Error(`Error retrieving tutees: ${err.message}`);
    }
}

const postTutor = async(req, res, next) => {
    try {
        const tutee = await Tutee.create(req.body);
        res
            .status(201)
            .setHeader('Content-Type', 'application/json')
            .json(tutee)
    } catch (err) {
        throw new Error(`Error creating tutee: ${err.message}`);
    }
    
}

const deleteTutors = async (req, res, next) => {
    try {
        await Tutee.deleteMany();
        res
            .status(200)
            .setHeader('Content-Type', 'application/json')
            .json({success:true, msg: 'Tutors removed'})
    } catch (err) {
        throw new Error(`Error removing tutees: ${err.message}`);
    }
   
}

const getTutor = async(req, res, next) => {
    try {
        const tutee = await Tutee.findById(req.params.tuteeId);
        res
            .status(200)
            .setHeader('Content-Type', 'application/json')
            .json(tutee)
    } catch (err) {
        throw new Error(`Error retrieving tutee ${req.params.tuteeId}: ${err.message}`);
    }
    
}

const deleteTutor = async(req, res, next) => {
    try {
        await Tutee.findByIdAndDelete(req.params.tuteeId);
        res
            .status(200)
            .setHeader('Content-Type', 'application/json')
            .json({success:true, msg: `Deleting tutee: ${req.params.tuteeId}`})
    } catch (err) {
        throw new Error(`Error deleting tutee ${req.params.tuteeId}: ${err.message}`);
    }
    
}

const updateTutor = async(req, res, next) => {
    try {
        const tutee = await Tutee.findByIdAndUpdate(req.params.tuteeId,{
            $set: req.body
        },{
            new: true
        });
        res
            .status(200)
            .setHeader('Content-Type', 'application/json')
            .json(tutee)
    } catch (err) {
        throw new Error(`Error updating tutee ${req.params.tuteeId}: ${err.message}`)
    }
    
};


// const postArtistImage = async (req, res ,next) => {
//         if(!req.files) throw new Error('Missing image!');

//         const file = req.files.file;

//         if(!file.mimetype.startsWith('image')) throw new Error('Please upload a image file type!');

//         if(file.size > process.env.MAX_FILE_SIZE) throw new Error(`Image exceeds size of ${process.env.MAX_FILE_SIZE}`);

//         file.name = `photo_${path.parse(file.name).ext}`;

//         const filePath = process.env.FILE_UPLOAD_PATH + file.name;

//         file.mv(filePath, async (err) => {
//         if(err) throw new Error(`Problem uploading photo: ${err.message}`);

//         await Tutee.findByIdAndUpdate(req.params.tuteeId, {image: file.name})
//         res
//         .status(200)
//         .setHeader('Content-Type', 'application/json')
//         .json({success: true, data: file.name})
//     })
// }


module.exports = {
    getTutees,
    postTutor,
    deleteTutors,
    login,
    logout,
    forgotPassword,
    resetPassword,
    updatePassword,
    getTutor,
    deleteTutor,
    updateTutor
}