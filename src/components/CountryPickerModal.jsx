import { useState } from 'react';
import {
  Modal, View, Text, TextInput, FlatList,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const COUNTRIES = [
  'Germany','Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Azerbaijan',
  'Bangladesh','Belarus','Belgium','Bolivia','Bosnia and Herzegovina','Brazil','Bulgaria',
  'Cambodia','Cameroon','Canada','Chile','China','Colombia','Croatia','Czech Republic',
  'Denmark','Ecuador','Egypt','Ethiopia','Finland','France','Georgia','Ghana','Greece',
  'Guatemala','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Japan','Jordan','Kazakhstan','Kenya','South Korea','Kosovo','Kuwait','Kyrgyzstan',
  'Lebanon','Libya','Malaysia','Mexico','Moldova','Mongolia','Montenegro','Morocco',
  'Myanmar','Nepal','Netherlands','New Zealand','Nigeria','North Macedonia','Norway',
  'Pakistan','Palestine','Peru','Philippines','Poland','Portugal','Romania','Russia',
  'Saudi Arabia','Senegal','Serbia','Singapore','Slovakia','Slovenia','Somalia','South Africa',
  'Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria','Taiwan','Tajikistan',
  'Tanzania','Thailand','Tunisia','Turkey','Turkmenistan','Uganda','Ukraine',
  'United Arab Emirates','United Kingdom','United States','Uzbekistan','Venezuela',
  'Vietnam','Yemen','Zimbabwe',
];

export default function CountryPickerModal({ visible, value, onSelect, onClose }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const filtered = query
    ? COUNTRIES.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : COUNTRIES;

  function handleSelect(country) {
    onSelect(country);
    setQuery('');
    onClose();
  }

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingTop: insets.top || 16 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Select Country</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search country…"
            placeholderTextColor="#555"
            value={query}
            onChangeText={setQuery}
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>

        {/* Clear selection */}
        {value !== '' && (
          <TouchableOpacity style={styles.clearRow} onPress={() => { onSelect(''); handleClose(); }}>
            <Text style={styles.clearText}>🌍  Clear selection</Text>
          </TouchableOpacity>
        )}

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={item => item}
          renderItem={({ item }) => {
            const isSelected = item === value;
            return (
              <TouchableOpacity
                style={[styles.item, isSelected && styles.itemSelected]}
                onPress={() => handleSelect(item)}
              >
                <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>{item}</Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.noResults}>No countries match "{query}"</Text>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1f1f1f',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  closeBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  closeBtnText: { color: '#6c47ff', fontSize: 15, fontWeight: '600' },
  searchRow: { padding: 12 },
  searchInput: {
    backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1,
    borderColor: '#2a2a2a', paddingHorizontal: 14, paddingVertical: 11,
    color: '#fff', fontSize: 15,
  },
  clearRow: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1f1f1f',
  },
  clearText: { color: '#6c47ff', fontSize: 14, fontWeight: '600' },
  item: { paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center' },
  itemSelected: { backgroundColor: 'rgba(108,71,255,0.12)' },
  itemText: { color: '#ccc', fontSize: 15, flex: 1 },
  itemTextSelected: { color: '#a78bfa', fontWeight: '700' },
  checkmark: { color: '#6c47ff', fontSize: 15, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#1a1a1a' },
  noResults: { color: '#555', fontSize: 14, textAlign: 'center', padding: 24 },
});
