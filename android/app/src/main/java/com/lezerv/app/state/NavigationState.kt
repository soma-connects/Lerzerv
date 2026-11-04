package com.lezerv.app.state

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class NavigationState(initialRole: Role = Role.Client) {
    var role by mutableStateOf(initialRole)
    var tab by mutableStateOf(Tab.Explore)
    var stack by mutableStateOf(listOf<Pushed>())
    val top: Pushed? get() = stack.lastOrNull()

    val homeTab get() = if (role == Role.Client) Tab.Explore else Tab.ArtisanMap

    fun push(p: Pushed) {
        stack = stack + p
    }

    fun pop(): Boolean {
        if (stack.isNotEmpty()) {
            stack = stack.dropLast(1)
            return true
        }
        return false
    }
}