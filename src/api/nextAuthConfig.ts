import NextAuth, { NextAuthOptions } from "next-auth"
import KeycloakProvider from "next-auth/providers/keycloak"
import { refreshAccessToken } from "./refreshAccessToken"

/**
 * Provides authOptions for next-auth that configures it for use with the typical HEKsso setup
 */
export const authOptions: NextAuthOptions = {
    secret: process.env.NEXTAUTH_SECRET,
    providers: [
        KeycloakProvider({
            clientId: process.env.KEYCLOAK_CLIENT_ID || "",
            clientSecret: process.env.KEYCLOAK_CLIENT_SECRET || "",
            issuer: process.env.KEYCLOAK_ISSUER, // something like "http://localhost:8080/realms/master"
            authorization: { params: { scope: "openid email profile roles" } }
        })
    ],
    pages: {
        signIn: "/",
    },
    callbacks: {
        async jwt(data) {
            const hekGroups = (data.profile as any)?.hekGroups

            // Persist the OAuth access_token to the token right after signin
            if (data.account && data.user) {
                data.token.idToken = data.account?.id_token
                data.token.accessToken = data.account.access_token
                data.token.hekGroups = hekGroups
                data.token.username = (data.profile as { [key: string]: string }).preferred_username

                if (data.account.expires_at)
                    data.token.accessTokenExpires = data.account.expires_at * 1000

                data.token.refreshToken = data.account.refresh_token
                return data.token
            }

            // Return previous token if the access token has not expired yet
            if (Date.now() < (data.token.accessTokenExpires as number)) {
                return data.token
            }

            // Access token has expired, try to update it
            return refreshAccessToken(data.token)
        },
        async session({ session, token }) {
            // Send properties to the client, like an access_token from a provider.
            const _session = session as any
            _session.accessToken = token.accessToken
            _session.accessTokenExpires = token.accessTokenExpires
            _session.hekGroups = token.hekGroups || []
            _session.username = token.username
            if (token.error) _session.error = token.error
            return _session
        }
    }
}
