import { signOut, useSession } from "next-auth/react"
import { NextRouter, useRouter } from "next/router"
import React, { Component, createContext, PropsWithChildren, useContext } from "react"

export interface KeycloakSession {
    accessTokenError: boolean
    getAccessToken: () => Promise<string>
}

export const KeycloakSessionContext = createContext<KeycloakSession>({
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
            console.error(data.error)
            return undefined
        }

        return { accessToken: data.accessToken, accessTokenExpires: data.accessTokenExpires }
    } catch (e: unknown) {
        console.error(e)
        return undefined
    }
}

interface KeycloakSessionProviderProps {
    session: ReturnType<typeof useSession>
    router: NextRouter
    signInPage?: string
}

interface KeycloakSessionProviderState {
    accessToken?: string
    accessTokenError: boolean
    accessTokenExpires?: number
}

export function KeycloakSessionProvider({
    signInPage,
    children
}: PropsWithChildren<{ signInPage?: string }>) {
    const router = useRouter()
    const session = useSession()

    return (
        <_KeycloakSessionProvider session={session} router={router} signInPage={signInPage}>
            {children}
        </_KeycloakSessionProvider>
    )
}

// Proxy class component to prevent unnecessary re-renders
class _KeycloakSessionProvider extends Component<
    PropsWithChildren<KeycloakSessionProviderProps>,
    KeycloakSessionProviderState
> {
    private contextValue

    constructor(props: KeycloakSessionProviderProps) {
        super(props)

        this.state = {
            accessTokenError: false
        }

        this.getAccessToken = this.getAccessToken.bind(this)
        this.getContextValue = this.getContextValue.bind(this)

        this.contextValue = {
            getAccessToken: this.getAccessToken,
            accessTokenError: false
        }
    }

    private getContextValue() {
        if (this.state.accessTokenError !== this.contextValue.accessTokenError) {
            this.contextValue = {
                getAccessToken: this.getAccessToken,
                accessTokenError: this.state.accessTokenError
            }
        }

        return this.contextValue
    }

    async getAccessToken() {
        if (!this.state.accessToken) return undefined
        if (this.state.accessTokenExpires && Date.now() >= this.state.accessTokenExpires) {
            try {
                const refreshed = await refreshAccessToken()

                if (refreshed) {
                    this.setState({
                        accessTokenError: false,
                        accessToken: refreshed.accessToken,
                        accessTokenExpires: refreshed.accessTokenExpires
                    })
                    return refreshed.accessToken
                } else {
                    // Refresh failed due to network error
                    return undefined
                }
            } catch (e) {
                // Refresh failed because keycloak denied the request
                console.error(e)
                this.setState({
                    accessTokenError: true,
                    accessToken: undefined,
                    accessTokenExpires: undefined
                })
                return undefined
            }
        } else return this.state.accessToken
    }

    componentDidUpdate(
        prevProps: Readonly<React.PropsWithChildren<KeycloakSessionProviderProps>>,
        prevState: Readonly<KeycloakSessionProviderState>,
        snapshot?: any
    ) {
        if (sessionDataGuard(this.props.session.data)) {
            const { error, accessToken, accessTokenExpires } = this.props.session.data

            if (error === "RefreshAccessTokenError") {
                // Force sign in to get a new refresh token
                signOut({ redirect: true, callbackUrl: "/" }).then()
            } else if (accessToken && accessToken != this.state.accessToken) {
                this.setState({
                    accessToken,
                    accessTokenExpires
                })
            } else if (!accessToken) {
                this.setState({
                    accessToken: undefined,
                    accessTokenExpires: undefined
                })
            }
        }
    }

    render() {
        return (
            <KeycloakSessionContext.Provider value={this.getContextValue()}>
                {this.props.children}
            </KeycloakSessionContext.Provider>
        )
    }
}

function sessionDataGuard(
    sessionData: unknown
): sessionData is { error?: string; accessToken?: string; accessTokenExpires?: number } {
    if (sessionData && typeof sessionData === "object") {
        if (!("error" in sessionData) || typeof sessionData.error === "string") {
            if (!("accessToken" in sessionData) || typeof sessionData.accessToken === "string") {
                if (
                    !("accessTokenExpires" in sessionData) ||
                    typeof sessionData.accessTokenExpires === "number"
                ) {
                    return true
                }
            }
        }
    }

    return false
}
