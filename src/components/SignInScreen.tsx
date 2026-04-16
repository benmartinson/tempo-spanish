import OAuthButton from './OAuthButton'
import { styles } from '../constants/AuthStyles'
import { useSignIn } from '@clerk/clerk-expo'
import { useNavigation } from '@react-navigation/native'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

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
        navigation.goBack()
      } else {
        console.error(JSON.stringify(signInAttempt, null, 2))
      }
    } catch (err: any) {
      console.error(JSON.stringify(err, null, 2))
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={headerStyles.header}>
        <View style={headerStyles.dragIndicator} />
      </View>
      <View style={styles.formContainer}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>Sign In</Text>
          <Text style={styles.subtitle}>Enter your credentials to access your account</Text>
        </View>

        <View style={{ marginBottom: 24, gap: 12 }}>
          <OAuthButton strategy="oauth_apple" />
          <OAuthButton strategy="oauth_google" />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
          <Text style={{ marginHorizontal: 12, color: '#94A3B8', fontSize: 13, fontWeight: '500' }}>or</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
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
    </View>
  )
}

const headerStyles = StyleSheet.create({
  header: {
    alignItems: 'center',
  },
  dragIndicator: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#d0d0d4',
    marginTop: 8,
    marginBottom: 8,
  },
})

export default SignInScreen
