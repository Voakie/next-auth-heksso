import { JWT } from "next-auth/jwt"

/**
 * Takes a token, and returns a new token with updated
 * `accessToken` and `accessTokenExpires`. If an error occurs,
 * returns the old token and an error property
 * 
 * This is a utility function and not an API route
 */
export async function refreshAccessToken(token: JWT) {
    try {
        const url = process.env.KEYCLOAK_ISSUER + "/protocol/openid-connect/token?"

        const response = await fetch(url, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            method: "POST",
            body: new URLSearchParams({
                client_id: process.env.KEYCLOAK_CLIENT_ID || "",
                client_secret: process.env.KEYCLOAK_CLIENT_SECRET || "",
                grant_type: "refresh_token",
                refresh_token: token.refreshToken as string
            })
        })

        const refreshedTokens = await response.json()

        if (!response.ok) {
            throw refreshedTokens
        }

        return {
            ...token,
            accessToken: refreshedTokens.access_token,
            accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
            refreshToken: refreshedTokens.refresh_token ?? token.refreshToken // Fall back to old refresh token
        }
    } catch (error) {
        console.log(error)

        return {
            ...token,
            error: "RefreshAccessTokenError"
        }
    }
}