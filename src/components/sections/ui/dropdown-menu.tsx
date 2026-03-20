import * as React from 'react';
import { View, Pressable, StyleSheet, Modal, ViewStyle } from 'react-native';

export interface DropdownMenuProps {
  children: React.ReactNode;
}

export interface DropdownMenuTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export interface DropdownMenuContentProps {
  align?: 'start' | 'end' | 'center';
  children: React.ReactNode;
  style?: ViewStyle;
}

export interface DropdownMenuItemProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
  disabled?: boolean;
}

export interface DropdownMenuSeparatorProps {
  style?: ViewStyle;
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({ children }) => {
  return <>{children}</>;
};

const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({ children, asChild }) => {
  return <>{children}</>;
};

const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({ children, align, style }) => {
  return (
    <View style={[styles.content, align === 'end' && styles.contentEnd, style]}>
      {children}
    </View>
  );
};

const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({ onPress, children, style, disabled }) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.item,
        pressed && !disabled && styles.itemPressed,
        disabled && styles.itemDisabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
};

const DropdownMenuSeparator: React.FC<DropdownMenuSeparatorProps> = ({ style }) => {
  return <View style={[styles.separator, style]} />;
};

const styles = StyleSheet.create({
  content: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    padding: 8,
    minWidth: 200,
  },
  contentEnd: {
    alignItems: 'flex-end',
  },
  item: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  itemPressed: {
    backgroundColor: '#f3f4f6',
  },
  itemDisabled: {
    opacity: 0.5,
  },
  separator: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
});

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
};
