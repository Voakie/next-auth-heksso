// /api/auth/federated-logout
import { NextApiRequest, NextApiResponse } from "next"
import * as jwt from "next-auth/jwt"

/**
 * Provides a next api route for performing a federated logout of the user (logs ouf of keycloak)
 * @param req NextApiRequest
 * @param res NextApiRequest
 * @returns 
 */
export default async function federatedLogout(req: NextApiRequest, res: NextApiResponse) {
    try {
        const token = await jwt.getToken({ req, secret: process.env.NEXTAUTH_SECRET })
        if (!token) {
            console.warn("No JWT token found when calling /federated-logout endpoint")
            return res.redirect(process.env.NEXTAUTH_URL || "")
        }

        const endsessionURL = `${process.env.KEYCLOAK_ISSUER}/protocol/openid-connect/logout`

        if (token.idToken) {
            console.warn(
                "Without an id_token the user won't be redirected back from the IdP after logout."
            )

            const endsessionParams = new URLSearchParams({
                id_token_hint: token.idToken as string,
                post_logout_redirect_uri: process.env.NEXTAUTH_URL + "/logout" || ""
            })
            return res.redirect(`${endsessionURL}?${endsessionParams}`)
        } else {
            return res.redirect(`${endsessionURL}`)
        }
    } catch (error) {
        console.error(error)
        res.redirect(process.env.NEXTAUTH_URL || "")
    }
}
