import * as React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';

export interface ButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  loading?: boolean;
  [key: string]: any;
}

const Button = React.forwardRef<any, ButtonProps>(
  ({ variant = 'default', size = 'default', children, onPress, disabled, style, loading, ...props }, ref) => {
    const variantStyle = styles[variant as keyof typeof styles] as ViewStyle;
    const sizeStyle = styles[`size_${size}` as keyof typeof styles] as ViewStyle;
    const textStyle = styles[`text_${variant}` as keyof typeof styles] as TextStyle;
    
    const buttonStyle = [
      styles.base,
      variantStyle,
      sizeStyle,
      disabled && styles.disabled,
      style,
    ];

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          ...buttonStyle,
          pressed && !disabled && styles.pressed,
        ]}
        {...props}
      >
        {loading ? (
          <ActivityIndicator size="small" color={variant === 'outline' || variant === 'ghost' ? '#0064c2' : '#ffffff'} />
        ) : (
          typeof children === 'string' ? <Text style={textStyle}>{children}</Text> : children
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  default: {
    backgroundColor: '#0064c2',
  },
  destructive: {
    backgroundColor: '#dc2626',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondary: {
    backgroundColor: '#6b7280',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  link: {
    backgroundColor: 'transparent',
  },
  size_default: {
    height: 40,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  size_sm: {
    height: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  size_lg: {
    height: 44,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 6,
  },
  size_icon: {
    height: 40,
    width: 40,
    padding: 0,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
  text_default: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  text_destructive: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  text_outline: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  text_secondary: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  text_ghost: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  text_link: {
    color: '#0064c2',
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});

export { Button };
