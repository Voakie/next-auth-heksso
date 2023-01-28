import { signOut, useSession } from "next-auth/react"
import { useRouter } from "next/router"
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react"

export interface KeycloakSession {
    isAuthenticated: boolean
    accessTokenError: boolean
    getAccessToken: () => Promise<string>
}

export const KeycloakSessionContext = createContext<KeycloakSession>({
    isAuthenticated: false,
    accessTokenError: false,
    getAccessToken: async () => {
        return ""
    }
})

export function useKeycloakSession() {
    return useContext(KeycloakSessionContext)
}

async function refreshAccessToken() {
    try {
        const response = await fetch("/api/auth/session", {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        })

        const data = await response.json()

        if (data.error) {
            throw data.error
        }

        return { accessToken: data.accessToken, accessTokenExpires: data.accessTokenExpires }
    } catch (e: unknown) {
        console.error(e)
        return undefined
    }
}

export function KeycloakSessionProvider(props: {
    children: ReactNode | ReactNode[]
    signInPage?: string
}) {
    const session = useSession()
    const router = useRouter()

    const [accessToken, setAccessToken] = useState<string | undefined>(undefined)
    const [accessTokenError, setAccessTokenError] = useState(false)
    const [accessTokenExpires, setAccessTokenExpires] = useState<number | undefined>(undefined)

    const getAccessToken = useCallback(async () => {
        if (!accessToken) return undefined
        if (accessTokenExpires && Date.now() >= accessTokenExpires) {
            try {
                const refreshed = await refreshAccessToken()

                if (refreshed) {
                    setAccessTokenError(false)
                    setAccessToken(refreshed.accessToken)
                    setAccessTokenExpires(refreshed.accessTokenExpires)
                    return refreshed.accessToken
                } else {
                    // Refresh failed due to network error
                    return undefined
                }
            } catch (e) {
                // Refresh failed because keycloak denied the request
                console.error(e)
                setAccessTokenError(true)
                setAccessToken(undefined)
                setAccessTokenExpires(undefined)
                return undefined
            }
        } else return accessToken
    }, [accessToken, accessTokenExpires])

    const isAuthenticated = useMemo(() => {
        return typeof accessToken === "string" && accessToken.length > 0
    }, [accessToken])

    // Because this component is present on every page that requires a session,
    // we check for a valid refresh token here
    useEffect(() => {
        if (
            !(router.asPath.split("?")[0] === (props.signInPage || "/auth/signin")) &&
            (session.status === "unauthenticated" || accessTokenError)
        ) {
            router.push(props.signInPage || "/auth/signin")
            return
        }

        if ((session.data as any)?.error === "RefreshAccessTokenError") {
            signOut() // Force sign in to get a new refresh token
        } else if ((session.data as any)?.accessToken) {
            setAccessToken((session.data as any)?.accessToken as string),
            setAccessTokenExpires((session.data as any)?.accessTokenExpires as number)
        } else {
            setAccessToken(undefined)
            setAccessTokenExpires(undefined)
        }
    }, [session, router.pathname, accessToken, router, props.signInPage, accessTokenError])

    return (
        <KeycloakSessionContext.Provider
            value={{ getAccessToken, isAuthenticated, accessTokenError }}
        >
            {props.children}
        </KeycloakSessionContext.Provider>
    )
}
