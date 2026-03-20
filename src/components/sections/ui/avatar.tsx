import * as React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, ImageStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export interface AvatarProps {
  className?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
}

export interface AvatarImageProps {
  src?: string;
  alt?: string;
  style?: ImageStyle;
}

export interface AvatarFallbackProps {
  className?: string;
  style?: ViewStyle;
  children?: React.ReactNode;
}

const Avatar = React.forwardRef<View, AvatarProps>(
  ({ style, children, ...props }, ref) => {
    return (
      <View ref={ref} style={[styles.avatar, style]} {...props}>
        {children}
      </View>
    );
  }
);

Avatar.displayName = 'Avatar';

const AvatarImage = React.forwardRef<Image, AvatarImageProps>(
  ({ src, alt, style, ...props }, ref) => {
    if (!src) return null;
    return (
      <Image
        ref={ref}
        source={{ uri: src }}
        style={[styles.avatarImage, style]}
        {...props}
      />
    );
  }
);

AvatarImage.displayName = 'AvatarImage';

const AvatarFallback = React.forwardRef<View, AvatarFallbackProps>(
  ({ style, children, ...props }, ref) => {
    return (
      <View ref={ref} style={[styles.avatarFallback, style]} {...props}>
        {typeof children === 'string' ? (
          <Text style={styles.avatarText}>{children}</Text>
        ) : children ? (
          children
        ) : (
          <Icon name="person" size={20} color="#6b7280" />
        )}
      </View>
    );
  }
);

AvatarFallback.displayName = 'AvatarFallback';

const styles = StyleSheet.create({
  avatar: {
    position: 'relative',
    height: 40,
    width: 40,
    flexShrink: 0,
    overflow: 'hidden',
    borderRadius: 20,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
    aspectRatio: 1,
  },
  avatarFallback: {
    flex: 1,
    height: '100%',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});

export { Avatar, AvatarImage, AvatarFallback };
