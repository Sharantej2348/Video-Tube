import {asyncHandler} from '../utils/asyncHandler.js'
import {apiError} from '../utils/apiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { apiResponse } from '../utils/apiResponse.js'
import jwt from 'jsonwebtoken'

const generateAccessAndrefreshTokens = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}
    } catch (error) {
        throw new apiError(500, "Something went Wrong while generating refresh and access tokens")
    }
}


const registerUser = asyncHandler( async (req, res) => {
    // 1. Get User Details from frontend
    // 2. Validation - Not Empty
    // 3. Check if user already exists: username, email
    // 4. Check for images, check for avatar
    // 5. Upload them to cloudinary, avatar
    // 6. create user object - create entry in db
    // 7. Remove password and refresh token field from response
    // 8. Check for user creation 
    // 9. Return response

        const {fullname, email, username, password } = req.body
    //console.log("email: ", email);

    if (
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new apiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new apiError(409, "User with email or username already exists")
    }
    //console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    

    if (!avatarLocalPath) {
        throw new apiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new apiError(400, "Avatar upload failed")
    }
   

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new apiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new apiResponse(201, createdUser, "User registered Successfully")
    )

})


const loginUser = asyncHandler( async(req, res) => {
    // 1. req body -> data
    // 2. username or email
    // 3. find the user
    // 4. password check
    // 5. access and refresh token 
    // 6. send cookie

    const {email, username, password} = req.body
    if(!username && !email){
        throw new apiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new apiError(404, "User does not exists !!")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new apiError(404, "invalid User credentials !!!")
    }

    const {accessToken, refreshToken} = await generateAccessAndrefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new apiResponse(200, {
            user: loggedInUser, accessToken,
            refreshToken
        },
        "User Logged in successfully")
    )
})


const logoutuser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged out successfully"))
})


const refreshAccessToken = asyncHandler(async(req, res) => {
   const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

   if(!incomingRefreshToken){
    throw new apiError(401, "Unauthorized Request")
   }

   try {
    const decodedToken = jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRET
    )
 
    const user = await User.findById(decodedToken?._id)
 
    if(!user){
     throw new apiError(401, "Invalid refresh Token")
    }
 
    if(incomingRefreshToken !== user?.refreshToken){
     throw new apiError(401, "Refresh token is expired or used")
    }
 
    const options = {
     httpOnly: true,
     secure: true
    }
 
    const {accessToken, newRefreshToken} = await generateAccessAndrefreshTokens(user._id)
 
    return res
    .status(200)
    .cookie("accessToekn", accessToken, options)
    .cookie("refreshToken", newRefreshToken, options)
    .json(
     new apiResponse(
         200,
         {accessToken, refreshToken: newRefreshToken},
         "Access Token refreshed"
     )
    )
   } catch (error) {
    throw new apiError(401, "Invalid Refresh Token")
   }
})

export {registerUser, loginUser, logoutuser, refreshAccessToken}