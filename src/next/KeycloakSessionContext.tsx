import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/router"
import React, { createContext, ReactNode, useCallback, useEffect, useState } from "react"

export interface KeycloakSession {
    accessToken?: string
    accessTokenError: boolean
    accessTokenExpires?: number
}

export interface KeycloakSessionState extends KeycloakSession {
    updateAccessToken(session: Partial<KeycloakSession>): void
}

export const KeycloakSessionContext = createContext<KeycloakSessionState>({
    accessTokenError: false,
    updateAccessToken: () => {
        console.error(
            "KeycloakSessionContext not correctly initialized. Make sure to use KeycloakSessionProvider instead of KeycloakSessionContext.Provider"
        )
    }
})

export function KeycloakSessionProvider(props: { children: ReactNode | ReactNode[], signInPage?: string }) {
    const session = useSession()
    const router = useRouter()

    const [accessToken, setAccessToken] = useState<string | undefined>(undefined)
    const [accessTokenError, setAccessTokenError] = useState(false)
    const [accessTokenExpires, setAccessTokenExpires] = useState<number | undefined>(undefined)

    const updateAccessToken = useCallback(
        (session: Partial<KeycloakSession>) => {
            if ("accessToken" in session) setAccessToken(session.accessToken)
            if ("accessTokenError" in session && typeof session.accessTokenError == "boolean")
                setAccessTokenError(session.accessTokenError)
            if ("accessTokenExpires" in session) setAccessTokenExpires(session.accessTokenExpires)
        },
        [accessToken, accessTokenError, accessTokenExpires]
    )

    // Because this component is present on every page that requires a session,
    // we check for a valid refresh token here
    useEffect(() => {
        if (
            !router.asPath.startsWith(props.signInPage || "/auth/signin") &&
            (session.status === "unauthenticated" || accessTokenError)
        ) {
            router.push(props.signInPage || "/auth/signin")
            return
        }

        if ((session.data as any)?.error === "RefreshAccessTokenError") {
            signOut() // Force sign in to get a new refresh token
        } else if ((session.data as any)?.accessToken) {
            updateAccessToken({
                accessToken: (session.data as any)?.accessToken as string,
                accessTokenExpires: (session.data as any)?.accessTokenExpires as number
            })
        } else {
            updateAccessToken({ accessToken: undefined, accessTokenExpires: undefined })
        }
    }, [session, router.pathname, accessToken, router])

    return (
        <KeycloakSessionContext.Provider
            value={{ accessToken, accessTokenError, accessTokenExpires, updateAccessToken }}
        >
            {props.children}
        </KeycloakSessionContext.Provider>
    )
}
