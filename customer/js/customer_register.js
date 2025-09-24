import {
    createImageToFirebase,
    updateProfileMethod,
    createUserWithEmailAndPasswordWrapper,
    sendEmailVerificationWrapper
} from "../../firebaseMethods.js";

// Helper function to get DOM elements
function getElement(id) {
    return document.getElementById(id);
}

// Main registration function
async function registerUser() {
    // Get form values
    const email = getElement("email").value;
    const password = getElement("password").value;
    const confirmPassword = getElement("confirmPassword").value;
    const username = getElement("username").value;
    const profilePhoto = getElement("profilePhoto").files[0];

    // Validation
    if (password !== confirmPassword) {
        alert("Oops! Your passwords don't match. Please try again.");
        return;
    }

    if (!email || !password || !username) {
        alert("Please fill in all required fields.");
        return;
    }

    try {
        // Create user account
        const userCredential = await createUserWithEmailAndPasswordWrapper(email, password);
        const user = userCredential.user;

        // Send verification email
        await sendEmailVerificationWrapper(user);
        alert("We've sent a verification email. Please check your inbox!");

        // Prepare user data for database - CORRECTED: Don't specify full path
        const userData = {
            username: username,
            email: email,
            status: "active",
            dateAccountCreated: new Date().toISOString(),
            firstName: getElement("firstName").value || "",
            lastName: getElement("lastName").value || "",
            phone: getElement("phone").value || "",
            gender: getSelectedGender(),
            birthday: getElement("birthDate").value || "",
            address: getElement("address").value || "",
            city: getElement("city").value || "",
            state: getElement("state").value || "",
            zip: getElement("zip").value || "",
            country: getElement("country").value || ""
        };

        // CORRECTED: Use the function without path parameter
        // If you want to specify the path explicitly
        const profileResult = await updateProfileMethod(user.uid, userData, `smartfit_AR_Database/customers/${user.uid}`);

        if (!profileResult.success) {
            throw new Error(`Failed to save profile: ${profileResult.error}`);
        }

        // Upload profile photo if provided
        if (profilePhoto) {
            try {
                const imageResult = await createImageToFirebase(
                    profilePhoto,
                    `customerProfile/${user.uid}/profile_${Date.now()}_${profilePhoto.name}`
                );

                if (imageResult.success) {
                    const photoData = {
                        profilePhoto: imageResult.url,
                        profilePhotoPath: imageResult.path,
                        profilePhotoUpdated: new Date().toISOString()
                    };

                    // CORRECTED: Use without path parameter
                    await updateProfileMethod(user.uid, photoData);
                }
            } catch (photoError) {
                console.warn("Profile photo upload failed, but account was created:", photoError);
                // Continue without photo
            }
        }

        alert("Registration successful! Please verify your email before logging in.");

    } catch (error) {
        console.error("Registration error:", error);

        // User-friendly error messages
        if (error.code === 'auth/email-already-in-use') {
            alert("This email is already registered. Please use a different email or try logging in.");
        } else if (error.code === 'auth/weak-password') {
            alert("Please choose a stronger password (at least 6 characters).");
        } else if (error.code === 'auth/invalid-email') {
            alert("Please enter a valid email address.");
        } else {
            alert(`Registration failed: ${error.message}`);
        }
    }
}

// Helper function to get selected gender from radio buttons
function getSelectedGender() {
    const selectedGender = document.querySelector('input[name="gender"]:checked');
    return selectedGender ? selectedGender.value : "not specified";
}

// Event listener for registration button
const registerButton = getElement("registerButton");
if (registerButton) {
    registerButton.addEventListener("click", (e) => {
        e.preventDefault();
        registerUser();
    });
}

const registrationForm = document.getElementById('registrationForm');
if (registrationForm) {
    registrationForm.addEventListener('submit', (e) => {
        e.preventDefault();
        registerUser();
    });
}