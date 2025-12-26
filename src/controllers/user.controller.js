import {asyncHandler} from '../utils/asyncHandler.js'
import {apiError} from '../utils/apiError.js'
import {User} from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { apiResponse } from '../utils/apiResponse.js'

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

    const {fullname, email, username, password} = req.body

    if(
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ){
        throw new apiError(400, "All fields are required !!!")
        
    }

    const existedUser = User.findOne({
        $or: [{username}, {email}]
    })
    if(existedUser){
        throw new apiError(409, "User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    if(!avatarLocalPath){
        throw new apiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new apiError(400, "Avatar file is required")
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
    if(!createdUser){
        throw new apiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new apiResponse(200, createdUser, "User registered successfully")
    )
})

export {registerUser}