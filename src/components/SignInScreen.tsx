import OAuthButton from './OAuthButton'
import { styles } from '../constants/AuthStyles'
import { useSignIn } from '@clerk/clerk-expo'
import { useNavigation } from '@react-navigation/native'
import { useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'

function SignInScreen() {
  const navigation = useNavigation<any>()
  const { signIn, isLoaded, setActive } = useSignIn()
  const [emailAddress, setEmailAddress] = useState('')
  const [password, setPassword] = useState('')

  const onSignInPress = async () => {
    if (!isLoaded || !setActive) return

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      })

      if (signInAttempt.status === 'complete') {
        await setActive({
          session: signInAttempt.createdSessionId,
        })
        // Navigation will happen automatically due to auth state change
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2))
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
    }
  }

  return (
    <View style={styles.formContainer}>
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>Enter your credentials to access your account</Text>
      </View>

      <View style={{ marginBottom: 24 }}>
        <OAuthButton strategy="oauth_google">Sign in with Google</OAuthButton>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email address"
            value={emailAddress}
            onChangeText={(text) => setEmailAddress(text)}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            value={password}
            onChangeText={(text) => setPassword(text)}
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={onSignInPress} activeOpacity={0.8}>
          <Text style={styles.buttonText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.textButton}
          onPress={() => navigation.navigate('SignUp')}
          activeOpacity={0.8}
        >
          <Text style={styles.textButtonText}>Don&apos;t have an account? Sign up.</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default SignInScreen
