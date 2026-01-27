import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import YouTubePlayer from './YouTubePlayer';
import { KeyVocabulary, VideoContext } from '../../types';

interface VideoProps {
  video: VideoContext;
  refreshKey: number;
  onBackButton: () => void;
  // onNextButton: () => void;
}

const Video: React.FC<VideoProps> = ({ video, refreshKey, onBackButton }) => {
  const clip = video.segments[video.currentSegment];
  const [translations, setTranslations] = useState<KeyVocabulary[]>([]);
  console.log({key_vocabulary: clip.key_vocabulary})

  const translateWord = async (word: KeyVocabulary) => {
    if (translations.find(translation => translation.value === word.value) !== undefined) return;
    setTranslations(prev => [...prev, word]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.button} onPress={onBackButton}>
          <Text style={styles.buttonText}>See All Videos</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.videoContainer}>
        <YouTubePlayer clip={{...clip, videoId: video.videoId}} autoplay={true} refreshKey={refreshKey} />
      </View>
      
      <ScrollView >  
        {clip.key_vocabulary && clip.key_vocabulary.length > 0 && (
          <View style={styles.vocabCard}>
            <Text style={styles.vocabTitle}>Vocab in this segment</Text>
            <ScrollView style={styles.vocabList}>
              {clip.key_vocabulary.map((word, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.vocabItem}
                  onPress={() => translateWord(word)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.vocabWord}>{word.value}</Text>
                  {translations.find(translation => translation.value === word.value) && (
                    <Text style={styles.vocabTranslation}>
                      {' => '}{translations.find(translation => translation.value === word.value)?.translation}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  button: {
    backgroundColor: '#3d3a52',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5a5680',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  videoContainer: {
    height: 230,
    backgroundColor: '#000',
  },
  vocabCard: {
    margin: 16,
    backgroundColor: '#2d2a40',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    // maxHeight: 200,
  },
  vocabTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  vocabList: {
    flexGrow: 0,
  },
  vocabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#3d3a52',
    borderRadius: 10,
    marginBottom: 8,
  },
  vocabWord: {
    color: '#a0a0b0',
    fontSize: 15,
    fontWeight: '600',
  },
  vocabTranslation: {
    color: '#a0a0b0',
    fontSize: 15,
    fontWeight: '500',
  },
  loader: {
    marginLeft: 8,
  },
});

export default Video;
